import * as XLSX from 'xlsx';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { MoyskladService } from '@/domains/shop/integrations/moySklad/moysklad.service';
import { StartPriceImportHandler } from './start-price-import.handler';
import { StartPriceImportCommand } from './start-price-import.command';
import { PriceListXlsxParser } from '../../infrastructure/xlsx/price-list-xlsx.parser';
import { PriceImportJob } from '../../domain/entities/price-import-job.entity';
import { ProductMatch } from '../../domain/value-objects/product-match.value-object';
import type { PriceImportJobStore } from '../ports/price-import-job-store.port';
import type {
    CatalogItem,
    ProductMatcher,
} from '../ports/product-matcher.port';
import type { ResultSheetGateway } from '../ports/result-sheet-gateway.port';
import type { CategoryKey } from '../../domain/services/row-categorization.service';

// Мини-XLSX с одной строкой iPhone (лист "Apple(iPhone, Watch)") и одной строкой MacBook (лист
// "Apple (iPad, Macbook)") — layout колонок/шапки повторяет структуру, которую ждёт
// PriceListXlsxParser (см. price-list-xlsx.parser.ts): для iPhone/Watch данные с 4-й строки
// (индекс 3), для iPad/MacBook — с 5-й (индекс 4). Строки-заполнители перед данными обязаны быть
// непустыми (`['—']`, а не `[]`) — иначе XLSX схлопывает диапазон листа до первой строки с
// реальными данными и `.slice()` в парсере отсчитывает не от той строки (см. тот же комментарий в
// price-list-xlsx.parser.spec.ts).
function buildPriceListFileBase64(): string {
    const workbook = XLSX.utils.book_new();

    const iphoneWatchSheet = XLSX.utils.aoa_to_sheet([
        ['—'],
        ['—'],
        ['—'],
        ['', 'Apple iPhone 16 128GB Black', '', 65000],
    ]);
    XLSX.utils.book_append_sheet(
        workbook,
        iphoneWatchSheet,
        'Apple(iPhone, Watch)',
    );

    const ipadMacbookSheet = XLSX.utils.aoa_to_sheet([
        ['—'],
        ['—'],
        ['—'],
        ['—'],
        ['MacBook Air 13 Midnight M5 16/512', '', 120000],
    ]);
    XLSX.utils.book_append_sheet(
        workbook,
        ipadMacbookSheet,
        'Apple (iPad, Macbook)',
    );

    const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
    }) as Buffer;
    return buffer.toString('base64');
}

function buildFakeJobStore(): {
    store: PriceImportJobStore;
    statusHistory: string[];
} {
    const jobs = new Map<string, PriceImportJob>();
    // `job` — один и тот же мутируемый объект на каждый save(), поэтому статус читается синхронно
    // в момент save(), а не из отложенно прочитанной ссылки на агрегат (см. тот же приём/комментарий
    // в in-memory-price-import-job.store.spec.ts).
    const statusHistory: string[] = [];
    const store: PriceImportJobStore = {
        save: (job) => {
            jobs.set(job.id, job);
            statusHistory.push(job.status);
        },
        findById: (id) => jobs.get(id),
        subscribe: () => undefined,
        delete: (id) => {
            jobs.delete(id);
        },
    };
    return { store, statusHistory };
}

function buildFakeMoysklad(): {
    moysklad: MoyskladService;
    batchUpdateProducts: jest.Mock;
} {
    const batchUpdateProducts = jest.fn().mockResolvedValue(undefined);
    const moysklad = {
        fetchAssortment: async function* (
            filter?: string,
        ): AsyncGenerator<{ id: string; name: string }[]> {
            void filter;
            await Promise.resolve();
            yield [{ id: 'ms-1', name: 'Каталожный товар' }];
        },
        batchUpdateProducts,
    } as unknown as MoyskladService;
    return { moysklad, batchUpdateProducts };
}

// Матчер, который сопоставляет первую строку прайса с первым товаром каталога той же категории.
function buildHappyPathMatcher(): ProductMatcher {
    return {
        formatProductNames: jest
            .fn()
            .mockImplementation((names: string[]) => Promise.resolve(names)),
        match: jest.fn().mockImplementation(
            (
                _category: CategoryKey,
                priceRows: {
                    name: string;
                    price: string | number | null;
                }[],
                catalogItems: CatalogItem[],
            ) => {
                if (priceRows.length === 0 || catalogItems.length === 0) {
                    return Promise.resolve([]);
                }
                return Promise.resolve([
                    ProductMatch.create({
                        sourceRowName: priceRows[0].name,
                        sourcePrice: Number(priceRows[0].price),
                        matchedProductId: catalogItems[0].id,
                        matchedProductName: catalogItems[0].name,
                        method: 'llm',
                        confidence: 1,
                    }),
                ]);
            },
        ),
    };
}

function buildFakeResultSheetGateway(): {
    gateway: ResultSheetGateway;
    writeCostChanges: jest.Mock;
} {
    const writeCostChanges = jest.fn().mockResolvedValue(undefined);
    return { gateway: { writeCostChanges }, writeCostChanges };
}

describe('StartPriceImportHandler', () => {
    it('happy path: проводит джобу CREATED -> RUNNING -> COMPLETED и пишет изменения цен', async () => {
        await withRequestContext(async () => {
            const { store, statusHistory } = buildFakeJobStore();
            const matcher = buildHappyPathMatcher();
            const { gateway, writeCostChanges } = buildFakeResultSheetGateway();
            const { moysklad, batchUpdateProducts } = buildFakeMoysklad();

            const handler = new StartPriceImportHandler(
                store,
                matcher,
                gateway,
                new PriceListXlsxParser(),
                moysklad,
            );

            const command = new StartPriceImportCommand({
                fileBase64: buildPriceListFileBase64(),
            });

            const result = await handler.execute(command);

            const job = store.findById(result.id);
            expect(job).toBeDefined();
            expect(job!.isCompleted()).toBe(true);
            expect(job!.result?.matches).toHaveLength(2); // iPhone + MacBook
            expect(job!.result?.costChanges).toHaveLength(2);

            expect(statusHistory[0]).toBe('CREATED');
            expect(statusHistory).toContain('RUNNING');
            expect(statusHistory[statusHistory.length - 1]).toBe('COMPLETED');

            expect(writeCostChanges).toHaveBeenCalledTimes(1);
            expect(batchUpdateProducts).toHaveBeenCalledTimes(1);
        });
    });

    it('матчер падает -> джоба переходит в FAILED с захваченным сообщением об ошибке', async () => {
        await withRequestContext(async () => {
            const { store, statusHistory } = buildFakeJobStore();
            const matcher: ProductMatcher = {
                formatProductNames: jest
                    .fn()
                    .mockImplementation((names: string[]) =>
                        Promise.resolve(names),
                    ),
                match: jest.fn().mockRejectedValue(new Error('AI недоступен')),
            };
            const { gateway, writeCostChanges } = buildFakeResultSheetGateway();
            const { moysklad, batchUpdateProducts } = buildFakeMoysklad();

            const handler = new StartPriceImportHandler(
                store,
                matcher,
                gateway,
                new PriceListXlsxParser(),
                moysklad,
            );

            const command = new StartPriceImportCommand({
                fileBase64: buildPriceListFileBase64(),
            });

            const result = await handler.execute(command);

            const job = store.findById(result.id);
            expect(job).toBeDefined();
            expect(job!.isFailed()).toBe(true);
            expect(job!.errorMessage).toBe('AI недоступен');

            expect(statusHistory[0]).toBe('CREATED');
            expect(statusHistory).toContain('RUNNING');
            expect(statusHistory[statusHistory.length - 1]).toBe('FAILED');

            // Пайплайн остановился до записи результата — ни МойСклад, ни таблица не тронуты.
            expect(writeCostChanges).not.toHaveBeenCalled();
            expect(batchUpdateProducts).not.toHaveBeenCalled();
        });
    });
});
