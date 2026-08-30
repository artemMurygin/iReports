import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MoySkladSyncModule } from '@/domains/shop/sync/moySklad/moysklad-sync.module';
import { SHOP_SALES_PLAN_REPOSITORY } from './application/ports/sales-plan.port';
import { SHOP_SALES_PLAN_TEMPLATE_REPOSITORY } from './application/ports/sales-plan-template.port';
import { ShopSalesPlanRepository } from './infrastructure/repositories/sales-plan.repository';
import { ShopSalesPlanTemplateRepository } from './infrastructure/repositories/sales-plan-template.repository';
import { CreateShopSalesPlanHandler } from './application/command/create-sales-plan.handler';
import { UpdateShopSalesPlanHandler } from './application/command/update-sales-plan.handler';
import { DeleteShopSalesPlanHandler } from './application/command/delete-sales-plan.handler';
import { ApproveShopSalesPlanHandler } from './application/command/approve-sales-plan.handler';
import { PutShopSalesPlanTemplateHandler } from './application/command/put-sales-plan-template.handler';
import { EnsureShopSalesPlansForPeriodService } from './application/services/ensure-sales-plans-for-period.service';
import { ListShopSalesPlansService } from './application/services/list-sales-plans.service';
import { ListShopSalesPlanTemplatesService } from './application/services/list-sales-plan-templates.service';
import { SHOP_SALES_FACT_SOURCE } from './application/ports/sales-fact-source.port';
import { MoySkladSalesFactSourceRepository } from './infrastructure/repositories/moysklad-sales-fact-source.repository';
import { SHOP_SALES_PERFORMANCE_READER } from './application/ports/sales-performance.port';
import { GetShopSalesPerformanceService } from './application/services/get-sales-performance.service';
import { ShopSalesPlanAutoCreationCron } from './infrastructure/cron/sales-plan-auto-creation.cron';
import { ListShopSalesPerformanceHttpController } from './interface/http-controllers/list-sales-performance.http.controller';
import { CreateShopSalesPlanHttpController } from './interface/http-controllers/create-sales-plan.http.controller';
import { UpdateShopSalesPlanHttpController } from './interface/http-controllers/update-sales-plan.http.controller';
import { DeleteShopSalesPlanHttpController } from './interface/http-controllers/delete-sales-plan.http.controller';
import { ApproveShopSalesPlanHttpController } from './interface/http-controllers/approve-sales-plan.http.controller';
import { ListShopSalesPlansHttpController } from './interface/http-controllers/list-sales-plans.http.controller';
import { ListShopSalesPlanTemplatesHttpController } from './interface/http-controllers/list-sales-plan-templates.http.controller';
import { PutShopSalesPlanTemplateHttpController } from './interface/http-controllers/put-sales-plan-template.http.controller';

// План/шаблон плана продаж (ShopSalesPlan/ShopSalesPlanTemplate) для shop —
// с Фазы 7 (docs/service-shop-boundary-violations-fix) собственная,
// независимая от domains/service/modules/sales реализация (entity/port/
// repository/мапперы/CQRS-команды в этом модуле), а не тонкий HTTP-слой
// поверх команд направления service, как было до этой фазы. Таблицы БД
// (sales_plans/sales_plan_templates) остаются общими — партиционированы
// полем direction (см. sales.prisma) — но каждый домен обращается к ним
// через свой собственный Prisma-репозиторий, всегда подставляющий/фильтрующий
// свой фиксированный direction: 'shop'.
//
// Помимо этого — то, что для shop действительно самостоятельно и было таким
// уже до Фазы 7: ERP-специфичный факт по МойСклад
// (ShopSalesFact/MoySkladSalesFactSourceRepository), сборка
// ShopSalesPerformance, собственный крон автосоздания плана и собственный
// HTTP-эндпоинт SalesPerformance (см.
// interface/http-controllers/list-sales-performance.http.controller.ts
// и обоснование отдельного пути в config/app.routes.ts).
//
// MoySkladSyncModule — источник ProductFolderTreeService (Фаза 1,
// docs/shop-sales-performance-by-category), которым
// MoySkladSalesFactSourceRepository раскрывает переданные aggregate()
// корневые categoryIds до дочерних папок — тот же приём, что уже применён
// в ShopAccountingModule для ShopCalculationDataRepository.
//
// SHOP_SALES_PLAN_REPOSITORY экспортируется — потребляется
// ShopAccountingModule (CloseShopAccountingPeriodHandler/
// GetShopDepartmentSalaryReportService/GetShopEmployeeSalaryReportService/
// GetShopClosePeriodPreviewService), который уже импортирует ShopSalesModule
// целиком ради SHOP_SALES_PERFORMANCE_READER — см. WHY там.
@Module({
    imports: [CqrsModule, MoySkladSyncModule],
    controllers: [
        ListShopSalesPerformanceHttpController,
        CreateShopSalesPlanHttpController,
        UpdateShopSalesPlanHttpController,
        DeleteShopSalesPlanHttpController,
        ApproveShopSalesPlanHttpController,
        ListShopSalesPlansHttpController,
        ListShopSalesPlanTemplatesHttpController,
        PutShopSalesPlanTemplateHttpController,
    ],
    providers: [
        {
            provide: SHOP_SALES_PLAN_REPOSITORY,
            useClass: ShopSalesPlanRepository,
        },
        {
            provide: SHOP_SALES_PLAN_TEMPLATE_REPOSITORY,
            useClass: ShopSalesPlanTemplateRepository,
        },
        CreateShopSalesPlanHandler,
        UpdateShopSalesPlanHandler,
        DeleteShopSalesPlanHandler,
        ApproveShopSalesPlanHandler,
        PutShopSalesPlanTemplateHandler,
        EnsureShopSalesPlansForPeriodService,
        ListShopSalesPlansService,
        ListShopSalesPlanTemplatesService,
        {
            provide: SHOP_SALES_FACT_SOURCE,
            useClass: MoySkladSalesFactSourceRepository,
        },
        GetShopSalesPerformanceService,
        // Алиас DI-токена на тот же провайдер — зеркало приёма из
        // SalesModule направления service (см. SALES_PERFORMANCE_READER
        // там): контроллер этого модуля инжектит GetShopSalesPerformanceService
        // напрямую, а domains/shop/modules/accounting инжектирует абстракцию
        // через SHOP_SALES_PERFORMANCE_READER.
        {
            provide: SHOP_SALES_PERFORMANCE_READER,
            useExisting: GetShopSalesPerformanceService,
        },
        ShopSalesPlanAutoCreationCron,
    ],
    exports: [SHOP_SALES_PERFORMANCE_READER, SHOP_SALES_PLAN_REPOSITORY],
})
export class ShopSalesModule {}
