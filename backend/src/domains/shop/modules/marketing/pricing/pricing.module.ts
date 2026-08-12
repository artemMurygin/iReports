import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AiModule } from '@/integrations/ai/ai.module';
import { GoogleSheetsModule } from '@/integrations/google-sheets/google-sheets.module';
import { MoyskladModule } from '@/domains/shop/integrations/moySklad/moysklad.module';
import { StartPriceImportHandler } from './application/command/start-price-import.handler';
import { PRICE_IMPORT_JOB_STORE } from './application/ports/price-import-job-store.port';
import { PRODUCT_MATCHER } from './application/ports/product-matcher.port';
import { RESULT_SHEET_GATEWAY } from './application/ports/result-sheet-gateway.port';
import { InMemoryPriceImportJobStore } from './infrastructure/stores/in-memory-price-import-job.store';
import { AiProductMatcherAdapter } from './infrastructure/ai/ai-product-matcher.adapter';
import { GoogleSheetsResultGateway } from './infrastructure/sheets/google-sheets-result.gateway';
import { PriceListXlsxParser } from './infrastructure/xlsx/price-list-xlsx.parser';

// Саб-группа marketing домена shop (Фаза 9, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) — джоба импорта
// закупочных цен из XLSX. Пока без контроллеров (`controllers: []`, Фаза 10 добавит HTTP/SSE) —
// эта фаза заводит только application/infrastructure и не подключается к `app.module.ts`, у неё
// ещё нет ни одного публичного входа.
//
// InMemoryPriceImportJobStore зарегистрирован как единственный provider на весь модуль (Nest DI
// module-scoped singleton) — то же требование "одно состояние джобы на процесс", что и у легаси
// PriceMonitoringProgressService.
@Module({
    imports: [CqrsModule, AiModule, GoogleSheetsModule, MoyskladModule],
    controllers: [],
    providers: [
        StartPriceImportHandler,
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
