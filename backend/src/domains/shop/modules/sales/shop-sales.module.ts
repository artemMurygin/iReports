import { Module } from '@nestjs/common';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import { SalesPlanRepository } from '@/domains/service/modules/sales/infrastructure/repositories/sales-plan.repository';
import { SalesPlanTemplateRepository } from '@/domains/service/modules/sales/infrastructure/repositories/sales-plan-template.repository';
import { EnsureSalesPlansForPeriodService } from '@/domains/service/modules/sales/application/services/ensure-sales-plans-for-period.service';
import { SHOP_SALES_FACT_SOURCE } from './application/ports/shop-sales-fact-source.port';
import { MoySkladSalesFactSourceRepository } from './infrastructure/repositories/moysklad-sales-fact-source.repository';
import { SHOP_SALES_PERFORMANCE_READER } from './application/ports/shop-sales-performance.port';
import { GetShopSalesPerformanceService } from './application/services/get-shop-sales-performance.service';
import { ShopSalesPlanAutoCreationCron } from './infrastructure/cron/shop-sales-plan-auto-creation.cron';
import { ListShopSalesPerformanceHttpController } from './interface/http-controllers/list-shop-sales-performance.http.controller';

// План/шаблон плана продаж (SalesPlan/SalesPlanTemplate, POST|GET|PATCH|
// DELETE /v1/sales/plan, GET|PUT /v1/sales/plan_template, POST
// /v1/sales/plan/approve) для направления shop уже полноценно обслуживаются
// существующими CRUD-эндпоинтами domains/service/modules/sales/sales.module.ts
// (SalesModule) — они не привязаны к direction: 'service' жёстко, а
// принимают direction параметром (тело/query) и одинаково работают для
// обоих направлений, потому что SalesPlan/SalesPlanTemplate — общие
// Prisma-модели с полем direction на каждой строке (см. sales.prisma) и не
// содержат ERP-специфичной логики. Этот модуль их НЕ дублирует (см. отчёт
// Фазы 11) — SalesModule продолжает быть единственным HTTP-входом для
// плана/шаблона для обоих направлений.
//
// Здесь — то, что для shop действительно самостоятельно: ERP-специфичный
// факт по МойСклад (ShopSalesFact/MoySkladSalesFactSourceRepository),
// сборка ShopSalesPerformance, собственный крон автосоздания плана и
// собственный HTTP-эндпоинт SalesPerformance (см.
// interface/http-controllers/list-shop-sales-performance.http.controller.ts
// и обоснование отдельного пути в config/app.routes.ts).
//
// SALES_PLAN_REPOSITORY/SALES_PLAN_TEMPLATE_REPOSITORY/
// EnsureSalesPlansForPeriodService переиспользуются как классы направления
// service (см. выше) — предоставлены здесь отдельными экземплярами (Nest DI
// не разделяет провайдеров между модулями без явного экспорта/импорта
// модуля), но это тот же генерик-код поверх общей Prisma-модели, не
// дублирование ERP-логики.
@Module({
    controllers: [ListShopSalesPerformanceHttpController],
    providers: [
        { provide: SALES_PLAN_REPOSITORY, useClass: SalesPlanRepository },
        {
            provide: SALES_PLAN_TEMPLATE_REPOSITORY,
            useClass: SalesPlanTemplateRepository,
        },
        EnsureSalesPlansForPeriodService,
        {
            provide: SHOP_SALES_FACT_SOURCE,
            useClass: MoySkladSalesFactSourceRepository,
        },
        GetShopSalesPerformanceService,
        // Алиас DI-токена на тот же провайдер — зеркало приёма из
        // SalesModule направления service (см. SALES_PERFORMANCE_READER
        // там): контроллер этого модуля инжектит GetShopSalesPerformanceService
        // напрямую, а будущий domains/shop/modules/accounting (Фаза 12)
        // будет инжектить абстракцию через SHOP_SALES_PERFORMANCE_READER.
        {
            provide: SHOP_SALES_PERFORMANCE_READER,
            useExisting: GetShopSalesPerformanceService,
        },
        ShopSalesPlanAutoCreationCron,
    ],
    exports: [SHOP_SALES_PERFORMANCE_READER],
})
export class ShopSalesModule {}
