import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AiModule } from '@/integrations/ai/ai.module';
import { GoogleSheetsModule } from '@/integrations/google-sheets/google-sheets.module';
import { MoyskladModule } from '@/domains/shop/integrations/moySklad/moysklad.module';
import { StartPriceImportHandler } from './application/command/start-price-import.handler';
import { GetPriceImportJobStatusService } from './application/services/get-price-import-job-status.service';
import { SubscribePriceImportJobProgressService } from './application/services/subscribe-price-import-job-progress.service';
import { PRICE_IMPORT_JOB_STORE } from './application/ports/price-import-job-store.port';
import { PRODUCT_MATCHER } from './application/ports/product-matcher.port';
import { RESULT_SHEET_GATEWAY } from './application/ports/result-sheet-gateway.port';
import { InMemoryPriceImportJobStore } from './infrastructure/stores/in-memory-price-import-job.store';
import { AiProductMatcherAdapter } from './infrastructure/ai/ai-product-matcher.adapter';
import { GoogleSheetsResultGateway } from './infrastructure/sheets/google-sheets-result.gateway';
import { PriceListXlsxParser } from './infrastructure/xlsx/price-list-xlsx.parser';
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
    imports: [CqrsModule, AiModule, GoogleSheetsModule, MoyskladModule],
    controllers: [
        StartPriceImportHttpController,
        GetPriceImportJobStatusHttpController,
        SubscribePriceImportJobProgressHttpController,
    ],
    providers: [
        StartPriceImportHandler,
        GetPriceImportJobStatusService,
        SubscribePriceImportJobProgressService,
        PriceListXlsxParser,
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
