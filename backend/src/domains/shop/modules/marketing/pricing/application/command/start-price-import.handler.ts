import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { StartPriceImportResponse } from 'ireports-contracts';
import { delay } from '@/shared/delay';
import { getErrorMessage } from '@/shared/utils/getErrorMessage';
import { MoyskladService } from '@/domains/shop/integrations/moySklad/moysklad.service';
import { PriceImportJob } from '../../domain/entities/price-import-job.entity';
import { JobProgress } from '../../domain/value-objects/job-progress.value-object';
import { ProductMatch } from '../../domain/value-objects/product-match.value-object';
import { CostChange } from '../../domain/value-objects/cost-change.value-object';
import {
    CategoryGroup,
    CategoryKey,
    RowCategorizationService,
} from '../../domain/services/row-categorization.service';
import { PriceListXlsxParser } from '../../infrastructure/xlsx/price-list-xlsx.parser';
import { CATEGORY_MS_FILTER } from '../../infrastructure/config/pricing.config';
import { buildMoySkladProductUpdates } from '../../infrastructure/moysklad/moysklad-cost-update.mapper';
import { PRICE_IMPORT_JOB_STORE } from '../ports/price-import-job-store.port';
import type { PriceImportJobStore } from '../ports/price-import-job-store.port';
import { PRODUCT_MATCHER } from '../ports/product-matcher.port';
import type {
    CatalogItem,
    ProductMatcher,
} from '../ports/product-matcher.port';
import { RESULT_SHEET_GATEWAY } from '../ports/result-sheet-gateway.port';
import type { ResultSheetGateway } from '../ports/result-sheet-gateway.port';
import { StartPriceImportCommand } from './start-price-import.command';

// Пайплайн импорта закупочных цен магазина (Фаза 9, см. PRD раздел 3а: "парсинг XLSX → каталог
// МойСклад → AI-сопоставление → обновление цен → запись результата в Sheets") — перенос легаси
// `PriceMonitoringService.updateShopProductsCosts` и его приватных хелперов
// (src/TODO/priceMonitoring/priceMonitoring.service.ts) поверх агрегата `PriceImportJob` (Фаза 8) и
// портов PRICE_IMPORT_JOB_STORE/PRODUCT_MATCHER/RESULT_SHEET_GATEWAY (эта фаза). МойСклад —
// напрямую через `MoyskladService` (см. domains/shop/CLAUDE.md: у `shop`, в отличие от `service`,
// нет отдельного порта-гейтвея для ERP — прямой инжект конкретного класса это установленная
// конвенция домена, не отступление от неё), XLSX-парсер — тоже напрямую, он детерминированный и
// без внешних зависимостей, подменять в тестах нечего (см. price-list-xlsx.parser.ts).
//
// Отличие от легаси: здесь пайплайн полностью await-ится внутри `execute()` (в легаси HTTP-
// контроллер делал `void this.priceMonitoringService.updateShopProductsCosts(...)` и сразу отвечал
// клиенту `{ id }`, не дожидаясь завершения) — fire-and-forget поведение остаётся ответственностью
// будущего HTTP-контроллера (Фаза 10: `void this.commandBus.execute(command)`), а не этого
// хендлера, чтобы полный прогон пайплайна можно было проверить интеграционным тестом без гонки.
@CommandHandler(StartPriceImportCommand)
export class StartPriceImportHandler implements ICommandHandler<
    StartPriceImportCommand,
    StartPriceImportResponse
> {
    private readonly logger = new Logger(StartPriceImportHandler.name);
    private readonly categorizer = new RowCategorizationService();

    constructor(
        @Inject(PRICE_IMPORT_JOB_STORE)
        private readonly jobStore: PriceImportJobStore,
        @Inject(PRODUCT_MATCHER)
        private readonly productMatcher: ProductMatcher,
        @Inject(RESULT_SHEET_GATEWAY)
        private readonly resultSheetGateway: ResultSheetGateway,
        private readonly xlsxParser: PriceListXlsxParser,
        private readonly moysklad: MoyskladService,
    ) {}

    async execute(
        command: StartPriceImportCommand,
    ): Promise<StartPriceImportResponse> {
        // `command.id` (базовый `Command.id`, генерируется в конструкторе, если явно не
        // передан) переиспользуется как id самой джобы — HTTP-контроллер (Фаза 10) конструирует
        // команду сам и отвечает клиенту `{ id: command.id }` не дожидаясь этого `execute()`
        // (fire-and-forget), поэтому id должен быть известен ДО создания агрегата, а не
        // сгенерирован заново внутри него.
        const job = PriceImportJob.create(command.id);
        this.jobStore.save(job);

        try {
            job.start();
            this.jobStore.save(job);

            const groups = await this.buildCategoryGroups(
                job,
                command.fileBase64,
            );
            const catalogByCategory = await this.loadCatalog(job, groups);
            const matches = await this.matchCategories(
                job,
                groups,
                catalogByCategory,
            );
            const costChanges = this.buildCostChanges(matches);

            await this.updateMoySklad(job, costChanges);
            await this.writeResults(job, costChanges);

            job.complete({ matches, costChanges });
            this.jobStore.save(job);
        } catch (error) {
            const message = getErrorMessage(error);
            this.logger.error(`[${job.id}] Ошибка импорта цен: ${message}`);
            job.fail(message);
            this.jobStore.save(job);
        }

        return { id: job.id };
    }

    private async buildCategoryGroups(
        job: PriceImportJob,
        fileBase64: string,
    ): Promise<CategoryGroup[]> {
        job.updateProgress(
            JobProgress.create({
                stage: 'parse',
                processed: 0,
                total: 1,
                message: 'Парсинг прайса...',
            }),
        );
        this.jobStore.save(job);

        const { iphoneWatchRows, ipadMacbookRawRows } =
            this.xlsxParser.parse(fileBase64);

        const formattedNames = await this.productMatcher.formatProductNames(
            ipadMacbookRawRows.map((row) => row.name),
        );
        const ipadMacbookRows = ipadMacbookRawRows.map((row, i) => ({
            ...row,
            name: formattedNames[i] ?? row.name,
        }));

        const groups = this.categorizer.categorize([
            ...iphoneWatchRows,
            ...ipadMacbookRows,
        ]);

        job.updateProgress(
            JobProgress.create({
                stage: 'parse',
                processed: 1,
                total: 1,
                message: `Категории: ${groups
                    .map((g) => `${g.category}(${g.rows.length})`)
                    .join(', ')}`,
            }),
        );
        this.jobStore.save(job);

        return groups;
    }

    private async loadCatalog(
        job: PriceImportJob,
        groups: CategoryGroup[],
    ): Promise<Map<CategoryKey, CatalogItem[]>> {
        const result = new Map<CategoryKey, CatalogItem[]>();

        job.updateProgress(
            JobProgress.create({
                stage: 'loadCatalog',
                processed: 0,
                total: groups.length,
                message: 'Загрузка каталога МойСклад...',
            }),
        );
        this.jobStore.save(job);

        let processed = 0;
        for (const group of groups) {
            // Только product — variant/bundle ведут на чужой entity-эндпоинт и валят batch-
            // обновление 404-кой (тот же комментарий, что был у легаси loadMoySkladCatalog).
            const filter = `${CATEGORY_MS_FILTER[group.category]};type=product`;
            const items: CatalogItem[] = [];
            for await (const page of this.moysklad.fetchAssortment(filter)) {
                items.push(...page);
            }
            await delay(350);
            result.set(group.category, items);

            processed += 1;
            job.updateProgress(
                JobProgress.create({
                    stage: 'loadCatalog',
                    processed,
                    total: groups.length,
                    message: `МС [${group.category}]: ${items.length} товаров`,
                }),
            );
            this.jobStore.save(job);
        }

        return result;
    }

    private async matchCategories(
        job: PriceImportJob,
        groups: CategoryGroup[],
        catalogByCategory: Map<CategoryKey, CatalogItem[]>,
    ): Promise<ProductMatch[]> {
        const allMatches: ProductMatch[] = [];

        job.updateProgress(
            JobProgress.create({
                stage: 'matchCategories',
                processed: 0,
                total: groups.length,
                message: 'Сопоставление с номенклатурой...',
            }),
        );
        this.jobStore.save(job);

        let processed = 0;
        for (const group of groups) {
            const catalogItems = catalogByCategory.get(group.category) ?? [];
            const matches = await this.productMatcher.match(
                group.category,
                group.rows,
                catalogItems,
            );
            allMatches.push(...matches);

            processed += 1;
            job.updateProgress(
                JobProgress.create({
                    stage: 'matchCategories',
                    processed,
                    total: groups.length,
                    message: `[${group.category}] сопоставлено: ${matches.length} позиций`,
                }),
            );
            this.jobStore.save(job);
        }

        return allMatches;
    }

    // Изменение принимается только для уже сопоставленных позиций с известной новой ценой — тот же
    // фактический фильтр, что был у легаси `buildMoySkladUpdates`/`writeResultsToSheet`
    // (`item.price != null && item.externalId != null`), но выраженный явно через доменные методы
    // ProductMatch, а не через ad-hoc проверку на null.
    private buildCostChanges(matches: ProductMatch[]): CostChange[] {
        return matches
            .filter(
                (match) => match.isMatched() && match.getSourcePrice() != null,
            )
            .map((match) =>
                CostChange.create({
                    productId: match.getMatchedProductId()!,
                    productName: match.getMatchedProductName()!,
                    // Старую закупочную цену пайплайн нигде не читает (каталог МойСклад отдаёт
                    // только id/name, см. MoyskladService.fetchAssortment) — то же ограничение,
                    // что и у легаси, которое тоже не сравнивало старую/новую цену.
                    oldCost: null,
                    newCost: match.getSourcePrice()!,
                }),
            );
    }

    private async updateMoySklad(
        job: PriceImportJob,
        costChanges: CostChange[],
    ): Promise<void> {
        const updates = buildMoySkladProductUpdates(costChanges);

        job.updateProgress(
            JobProgress.create({
                stage: 'updateMoySklad',
                processed: 0,
                total: 1,
                message: `Обновление МойСклад (${updates.length} позиций)...`,
            }),
        );
        this.jobStore.save(job);

        await this.moysklad.batchUpdateProducts(updates);

        job.updateProgress(
            JobProgress.create({
                stage: 'updateMoySklad',
                processed: 1,
                total: 1,
                message: 'МойСклад обновлён',
            }),
        );
        this.jobStore.save(job);
    }

    private async writeResults(
        job: PriceImportJob,
        costChanges: CostChange[],
    ): Promise<void> {
        job.updateProgress(
            JobProgress.create({
                stage: 'writeSheet',
                processed: 0,
                total: 1,
                message: 'Запись результатов в таблицу...',
            }),
        );
        this.jobStore.save(job);

        await this.resultSheetGateway.writeCostChanges(costChanges);

        job.updateProgress(
            JobProgress.create({
                stage: 'writeSheet',
                processed: 1,
                total: 1,
                message: 'Результаты записаны',
            }),
        );
        this.jobStore.save(job);
    }
}
