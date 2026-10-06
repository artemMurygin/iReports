import { Inject, Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { StartPriceImportCommand } from '../command/start-price-import.command';
import { LAST_SCHEDULED_IMPORT_STORE } from '../ports/last-scheduled-import-store.port';
import type { LastScheduledImportStore } from '../ports/last-scheduled-import-store.port';
import { MOYSKLAD_PRICE_UPDATE_TRIGGER } from '../ports/moysklad-price-update-trigger.port';
import type {
    MoySkladPriceUpdateResult,
    MoySkladPriceUpdateTrigger,
} from '../ports/moysklad-price-update-trigger.port';
import { PRICE_IMPORT_JOB_STORE } from '../ports/price-import-job-store.port';
import type { PriceImportJobStore } from '../ports/price-import-job-store.port';
import { PRICE_IMPORT_NOTIFIER } from '../ports/price-import-notifier.port';
import type { PriceImportNotifier } from '../ports/price-import-notifier.port';
import { PRICE_LIST_SOURCE } from '../ports/price-list-source.port';
import type { PriceListSource } from '../ports/price-list-source.port';
import { PRICE_LIST_VERSION_STORE } from '../ports/price-list-version-store.port';
import type { PriceListVersionStore } from '../ports/price-list-version-store.port';
import { PriceImportAlreadyRunningException } from '../../domain/exceptions/scheduled-price-import.exception';
import { ScheduledImportOutcome } from '../../domain/value-objects/scheduled-import-outcome.value-object';
import { toError } from '@/shared/logger/to-error';

// Оркестрация автоматической выгрузки прайса по расписанию (spec: shop/price-import-schedule).
// run() никогда не бросает: любая ошибка превращается в failed-итог + уведомление, подробности —
// только в лог (в Telegram технические детали не уходят).
@Injectable()
export class RunScheduledPriceImportService {
    private readonly logger = new Logger(RunScheduledPriceImportService.name);

    constructor(
        @Inject(PRICE_LIST_SOURCE)
        private readonly source: PriceListSource,
        @Inject(PRICE_LIST_VERSION_STORE)
        private readonly versionStore: PriceListVersionStore,
        @Inject(PRICE_IMPORT_NOTIFIER)
        private readonly notifier: PriceImportNotifier,
        @Inject(PRICE_IMPORT_JOB_STORE)
        private readonly jobStore: PriceImportJobStore,
        private readonly commandBus: CommandBus,
        @Inject(MOYSKLAD_PRICE_UPDATE_TRIGGER)
        private readonly priceUpdateTrigger: MoySkladPriceUpdateTrigger,
        @Inject(LAST_SCHEDULED_IMPORT_STORE)
        private readonly lastRunStore: LastScheduledImportStore,
    ) {}

    async run(): Promise<ScheduledImportOutcome> {
        const outcome = await this.runAndNotify();
        await this.recordLastRun(outcome);
        return outcome;
    }

    // spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
    // Сайдбар Google Sheets не знает о запусках по крону — запоминаем итог, чтобы он показал время.
    // «Не изменился» — не выгрузка, время не трогаем.
    private async recordLastRun(
        outcome: ScheduledImportOutcome,
    ): Promise<void> {
        const kind = outcome.getKind();
        if (kind === 'unchanged') return;
        try {
            await this.lastRunStore.save({
                status: kind === 'uploaded' ? 'success' : 'error',
                finishedAt: Date.now(),
            });
        } catch (error) {
            this.logger.error(
                `Не удалось запомнить время последней автовыгрузки: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    private async runAndNotify(): Promise<ScheduledImportOutcome> {
        try {
            return await this.execute();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                { err: toError(error) },
                'Автоматическая выгрузка прайса завершилась ошибкой',
            );
            await this.safeNotify(() => this.notifier.notifyFailed());
            return ScheduledImportOutcome.failed(message);
        }
    }

    private async execute(): Promise<ScheduledImportOutcome> {
        // spec: shop/price-import-schedule#не-более-одной-выгрузки-одновременно
        if (this.jobStore.findActive()) {
            throw new PriceImportAlreadyRunningException();
        }

        const file = await this.source.findPriceListFile();

        // spec: shop/price-import-schedule#выгрузка-только-при-изменении-прайса
        const lastName = await this.versionStore.getLastUploadedName();
        if (lastName === file.getName()) {
            await this.safeNotify(() => this.notifier.notifyUnchanged());
            return ScheduledImportOutcome.unchanged();
        }

        // spec: shop/price-import-schedule#единый-пайплайн-выгрузки
        const content = await this.source.download(file);
        const command = new StartPriceImportCommand({
            fileBase64: content.toString('base64'),
        });
        await this.commandBus.execute(command);

        const job = this.jobStore.findById(command.id);
        if (!job) {
            throw new Error(
                `Джоба импорта ${command.id} не найдена после выполнения`,
            );
        }
        if (job.status !== 'COMPLETED') {
            throw new Error(
                `Выгрузка цен завершилась со статусом ${job.status}`,
            );
        }

        // Название запоминаем до уведомления и независимо от его доставки.
        await this.versionStore.saveUploadedName(file.getName());

        // spec: shop/price-import-schedule#обновление-цен-в-моём-складе-через-n8n
        // Сбой n8n не делает выгрузку неуспешной (прайс уже в таблице и МойСклад) — вместо
        // «выгружено» уходит отдельное уведомление с просьбой повторить обновление вручную.
        const priceUpdate = await this.triggerPriceUpdate();
        await this.recordPriceUpdate(priceUpdate);
        if (!priceUpdate.uploadSale || !priceUpdate.uploadRc) {
            await this.safeNotify(() =>
                this.notifier.notifyPriceUpdateFailed(),
            );
            return ScheduledImportOutcome.uploaded();
        }

        await this.safeNotify(() => this.notifier.notifyUploaded());
        return ScheduledImportOutcome.uploaded();
    }

    private async triggerPriceUpdate(): Promise<MoySkladPriceUpdateResult> {
        try {
            return await this.priceUpdateTrigger.triggerPriceUpdate();
        } catch (error) {
            this.logger.error(
                `Обновление цен в МойСклад через n8n не выполнено: ${error instanceof Error ? error.message : String(error)}`,
            );
            return { uploadSale: false, uploadRc: false };
        }
    }

    // spec: shop/price-import-schedule#время-последней-автоматической-выгрузки
    // Сайдбар показывает время обновления цен в МойСклад (РЦ и акционная РЦ) по этим записям.
    private async recordPriceUpdate(
        result: MoySkladPriceUpdateResult,
    ): Promise<void> {
        const finishedAt = Date.now();
        for (const target of ['uploadSale', 'uploadRc'] as const) {
            try {
                await this.lastRunStore.savePriceUpdate(target, {
                    status: result[target] ? 'success' : 'error',
                    finishedAt,
                });
            } catch (error) {
                this.logger.error(
                    `Не удалось запомнить время обновления цен (${target}): ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }
    }

    // spec: shop/price-import-schedule#отказоустойчивость-уведомлений
    private async safeNotify(send: () => Promise<void>): Promise<void> {
        try {
            await send();
        } catch (error) {
            this.logger.error(
                `Не удалось отправить уведомление: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
