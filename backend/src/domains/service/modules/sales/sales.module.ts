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
    ],
    providers: [
        { provide: LEAD_REPOSITORY, useClass: LeadRepository },
        { provide: SALES_PLAN_REPOSITORY, useClass: SalesPlanRepository },
        {
            provide: SALES_PLAN_TEMPLATE_REPOSITORY,
            useClass: SalesPlanTemplateRepository,
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
    ],
    exports: [
        LEAD_REPOSITORY,
        // Экспортируется заранее для Фазы 5 (accounting читает
        // SalesPerformance через порт этого модуля, без дублирования
        // расчёта плана — см. "Когда готово" Фазы 5 плана).
        SALES_PLAN_REPOSITORY,
        SALES_PLAN_TEMPLATE_REPOSITORY,
    ],
})
export class SalesModule {}
