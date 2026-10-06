import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AiModule } from '@/integrations/ai/ai.module';
import { GoogleSheetsModule } from '@/integrations/google-sheets/google-sheets.module';
import { TelegramModule } from '@/integrations/telegram/telegram.module';
import { MoyskladModule } from '@/domains/shop/integrations/moySklad/moysklad.module';
import { StartPriceImportHandler } from './application/command/start-price-import.handler';
import { GetPriceImportJobStatusService } from './application/services/get-price-import-job-status.service';
import { SubscribePriceImportJobProgressService } from './application/services/subscribe-price-import-job-progress.service';
import { GetActivePriceImportJobService } from './application/services/get-active-price-import-job.service';
import { CancelPriceImportJobService } from './application/services/cancel-price-import-job.service';
import { PRICE_IMPORT_ABORT_REGISTRY } from './application/ports/price-import-abort-registry.port';
import { InMemoryPriceImportAbortRegistry } from './infrastructure/abort/in-memory-price-import-abort.registry';
import { GetActivePriceImportJobHttpController } from './interface/http-controllers/get-active-price-import-job.http.controller';
import { CancelPriceImportJobHttpController } from './interface/http-controllers/cancel-price-import-job.http.controller';
import { PRICE_IMPORT_JOB_STORE } from './application/ports/price-import-job-store.port';
import { PRODUCT_MATCHER } from './application/ports/product-matcher.port';
import { RESULT_SHEET_GATEWAY } from './application/ports/result-sheet-gateway.port';
import { InMemoryPriceImportJobStore } from './infrastructure/stores/in-memory-price-import-job.store';
import { AiProductMatcherAdapter } from './infrastructure/ai/ai-product-matcher.adapter';
import { GoogleSheetsResultGateway } from './infrastructure/sheets/google-sheets-result.gateway';
import { PriceListXlsxParser } from './infrastructure/xlsx/price-list-xlsx.parser';
import { RunScheduledPriceImportService } from './application/services/run-scheduled-price-import.service';
import { ScheduledPriceImportCron } from './interface/cron/scheduled-price-import.cron';
import { PRICE_LIST_SOURCE } from './application/ports/price-list-source.port';
import { PRICE_LIST_VERSION_STORE } from './application/ports/price-list-version-store.port';
import { PRICE_IMPORT_NOTIFIER } from './application/ports/price-import-notifier.port';
import { GoogleDrivePriceListSource } from './infrastructure/drive/google-drive-price-list.source';
import { MOYSKLAD_PRICE_UPDATE_TRIGGER } from './application/ports/moysklad-price-update-trigger.port';
import { N8nMoySkladPriceUpdateTrigger } from './infrastructure/n8n/n8n-moysklad-price-update.trigger';
import { LAST_SCHEDULED_IMPORT_STORE } from './application/ports/last-scheduled-import-store.port';
import { RedisLastScheduledImportStore } from './infrastructure/redis/redis-last-scheduled-import.store';
import { GetLastScheduledPriceImportService } from './application/services/get-last-scheduled-price-import.service';
import { GetLastScheduledPriceImportHttpController } from './interface/http-controllers/get-last-scheduled-price-import.http.controller';
import { RedisPriceListVersionStore } from './infrastructure/redis/redis-price-list-version.store';
import { TelegramPriceImportNotifier } from './infrastructure/telegram/telegram-price-import.notifier';
import { StartPriceImportHttpController } from './interface/http-controllers/start-price-import.http.controller';
import { GetPriceImportJobStatusHttpController } from './interface/http-controllers/get-price-import-job-status.http.controller';
import { SubscribePriceImportJobProgressHttpController } from './interface/http-controllers/subscribe-price-import-job-progress.http.controller';

// Саб-группа marketing домена shop (Фазы 9-10, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) — джоба импорта
// закупочных цен из XLSX. С Фазы 10 — три HTTP/SSE-контроллера
// (`import-costs`, `.../status`, SSE `.../:id`), подключён в `app.module.ts`
// и в `shopDocument` Swagger (см. swagger.config.ts).
//
// InMemoryPriceImportJobStore зарегистрирован как единственный provider на весь модуль (Nest DI
// module-scoped singleton) — то же требование "одно состояние джобы на процесс", что и у легаси
// PriceMonitoringProgressService.
@Module({
    imports: [CqrsModule, AiModule, GoogleSheetsModule, MoyskladModule, TelegramModule],
    controllers: [
        StartPriceImportHttpController,
        GetPriceImportJobStatusHttpController,
        SubscribePriceImportJobProgressHttpController,
        GetActivePriceImportJobHttpController,
        CancelPriceImportJobHttpController,
        GetLastScheduledPriceImportHttpController,
    ],
    providers: [
        StartPriceImportHandler,
        GetPriceImportJobStatusService,
        SubscribePriceImportJobProgressService,
        GetActivePriceImportJobService,
        CancelPriceImportJobService,
        GetLastScheduledPriceImportService,
        {
            provide: LAST_SCHEDULED_IMPORT_STORE,
            useClass: RedisLastScheduledImportStore,
        },
        PriceListXlsxParser,
        // Автовыгрузка по расписанию (spec: shop/price-import-schedule). RedisModule глобальный.
        RunScheduledPriceImportService,
        ScheduledPriceImportCron,
        { provide: PRICE_LIST_SOURCE, useClass: GoogleDrivePriceListSource },
        { provide: PRICE_LIST_VERSION_STORE, useClass: RedisPriceListVersionStore },
        { provide: PRICE_IMPORT_NOTIFIER, useClass: TelegramPriceImportNotifier },
        {
            provide: MOYSKLAD_PRICE_UPDATE_TRIGGER,
            useClass: N8nMoySkladPriceUpdateTrigger,
        },
        {
            provide: PRICE_IMPORT_ABORT_REGISTRY,
            useClass: InMemoryPriceImportAbortRegistry,
        },
        {
            provide: PRICE_IMPORT_JOB_STORE,
            useClass: InMemoryPriceImportJobStore,
        },
        { provide: PRODUCT_MATCHER, useClass: AiProductMatcherAdapter },
        { provide: RESULT_SHEET_GATEWAY, useClass: GoogleSheetsResultGateway },
    ],
    exports: [PRICE_IMPORT_JOB_STORE],
})
export class ShopPricingModule {}
