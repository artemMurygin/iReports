import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LEAD_REPOSITORY } from './domain/ports/sales.repositories.port';
import { LeadRepository } from './infrastructure/sales.repositories';
import { SALES_PLAN_REPOSITORY } from './application/ports/sales-plan.port';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from './application/ports/sales-plan-template.port';
import { SalesPlanRepository } from './infrastructure/repositories/sales-plan.repository';
import { SalesPlanTemplateRepository } from './infrastructure/repositories/sales-plan-template.repository';
import { CreateSalesPlanHandler } from './application/command/create-sales-plan.handler';
import { UpdateSalesPlanHandler } from './application/command/update-sales-plan.handler';
import { DeleteSalesPlanHandler } from './application/command/delete-sales-plan.handler';
import { ApproveSalesPlanHandler } from './application/command/approve-sales-plan.handler';
import { PutSalesPlanTemplateHandler } from './application/command/put-sales-plan-template.handler';
import { EnsureSalesPlansForPeriodService } from './application/services/ensure-sales-plans-for-period.service';
import { ListSalesPlansService } from './application/services/list-sales-plans.service';
import { ListSalesPlanTemplatesService } from './application/services/list-sales-plan-templates.service';
import { SalesPlanAutoCreationCron } from './infrastructure/cron/sales-plan-auto-creation.cron';
import { CreateSalesPlanHttpController } from './interface/http-controllers/create-sales-plan.http.controller';
import { UpdateSalesPlanHttpController } from './interface/http-controllers/update-sales-plan.http.controller';
import { DeleteSalesPlanHttpController } from './interface/http-controllers/delete-sales-plan.http.controller';
import { ApproveSalesPlanHttpController } from './interface/http-controllers/approve-sales-plan.http.controller';
import { ListSalesPlansHttpController } from './interface/http-controllers/list-sales-plans.http.controller';
import { PutSalesPlanTemplateHttpController } from './interface/http-controllers/put-sales-plan-template.http.controller';
import { ListSalesPlanTemplatesHttpController } from './interface/http-controllers/list-sales-plan-templates.http.controller';
import { SERVICE_SALES_FACT_SOURCE } from './application/ports/service-sales-fact-source.port';
import { RoappSalesFactSourceRepository } from './infrastructure/repositories/roapp-sales-fact-source.repository';
import { SALES_PERFORMANCE_READER } from './application/ports/sales-performance.port';
import { GetSalesPerformanceService } from './application/services/get-sales-performance.service';
import { ListSalesPerformanceHttpController } from './interface/http-controllers/list-sales-performance.http.controller';
import { DEAL_LIST_REPOSITORY } from './application/ports/deal-list.port';
import { DealListRepository } from './infrastructure/repositories/deal-list.repository';
import { ListDealsService } from './application/services/list-deals.service';
import { ListDealsHttpController } from './interface/http-controllers/list-deals.http.controller';
// Отчёт по воронке сервисных сделок (Фаза 4, см.
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) —
// новый дом для GET /reports/service-funnel из src/TODO/reports.
import { FUNNEL_DEAL_REPOSITORY } from './application/ports/funnel-deal.port';
import { FunnelDealRepository } from './infrastructure/repositories/funnel-deal.repository';
import { GetServiceFunnelReportService } from './application/services/get-service-funnel-report.service';
import { GetServiceFunnelReportHttpController } from './interface/http-controllers/get-service-funnel-report.http.controller';

// LEAD_REPOSITORY (сделки/лиды, см. domain/entities/{deal,lead}.entity.ts) —
// более ранняя, не задействованная пока часть модуля (см.
// src/domains/service/CLAUDE.md, "modules/sales — сделки и лиды"). План
// продаж (Фаза 3 + автосоздание Фазы 4, docs/payroll/plan-payroll-calculation.md)
// живёт в том же модуле по смыслу route-неймспейса (/sales/plan*) и бизнес-
// области "продажи", но слоистость и провайдеры у него отдельные — оба
// среза самостоятельны и не переиспользуют код друг друга.
@Module({
    imports: [CqrsModule],
    controllers: [
        CreateSalesPlanHttpController,
        UpdateSalesPlanHttpController,
        DeleteSalesPlanHttpController,
        ApproveSalesPlanHttpController,
        ListSalesPlansHttpController,
        PutSalesPlanTemplateHttpController,
        ListSalesPlanTemplatesHttpController,
        ListSalesPerformanceHttpController,
        ListDealsHttpController,
        GetServiceFunnelReportHttpController,
    ],
    providers: [
        { provide: LEAD_REPOSITORY, useClass: LeadRepository },
        { provide: SALES_PLAN_REPOSITORY, useClass: SalesPlanRepository },
        {
            provide: SALES_PLAN_TEMPLATE_REPOSITORY,
            useClass: SalesPlanTemplateRepository,
        },
        {
            provide: SERVICE_SALES_FACT_SOURCE,
            useClass: RoappSalesFactSourceRepository,
        },
        CreateSalesPlanHandler,
        UpdateSalesPlanHandler,
        DeleteSalesPlanHandler,
        ApproveSalesPlanHandler,
        PutSalesPlanTemplateHandler,
        EnsureSalesPlansForPeriodService,
        ListSalesPlansService,
        ListSalesPlanTemplatesService,
        SalesPlanAutoCreationCron,
        GetSalesPerformanceService,
        // Алиас DI-токена на тот же провайдер, что и конкретный класс —
        // HTTP-контроллер этого модуля инжектит GetSalesPerformanceService
        // напрямую, а accounting (Фаза 9) будет инжектить абстракцию через
        // SALES_PERFORMANCE_READER (см. application/ports/sales-performance.port.ts).
        {
            provide: SALES_PERFORMANCE_READER,
            useExisting: GetSalesPerformanceService,
        },
        // Read-side списка сделок (GET /v1/service/sales/deals, см.
        // задание миграции TODO/deals → modules/sales) — HTTP-контроллер
        // см. ListDealsHttpController выше, в controllers.
        { provide: DEAL_LIST_REPOSITORY, useClass: DealListRepository },
        ListDealsService,
        // Read-side отчёта по воронке (GET /v1/service/sales/funnel-report,
        // см. задание миграции TODO/reports → modules/sales, Фаза 4) —
        // HTTP-контроллер см. GetServiceFunnelReportHttpController выше, в
        // controllers.
        { provide: FUNNEL_DEAL_REPOSITORY, useClass: FunnelDealRepository },
        GetServiceFunnelReportService,
    ],
    exports: [
        LEAD_REPOSITORY,
        SALES_PLAN_REPOSITORY,
        SALES_PLAN_TEMPLATE_REPOSITORY,
        // Порт чтения SalesPerformance для accounting (Фаза 5 — "Когда
        // готово": "дублирующего расчёта плана внутри зарплатного модуля
        // нет").
        SALES_PERFORMANCE_READER,
    ],
})
export class SalesModule {}
