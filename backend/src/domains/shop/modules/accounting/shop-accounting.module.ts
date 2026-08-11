import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ShopSalesModule } from '@/domains/shop/modules/sales/shop-sales.module';
import { MoySkladSyncModule } from '@/domains/shop/sync/moySklad/moysklad-sync.module';
import { ListShopSalaryRuleTypesService } from '@/domains/shop/modules/accounting/application/services/list-salary-rule-types.service';
import { ListShopTaskCompletionsService } from '@/domains/shop/modules/accounting/application/services/list-shop-task-completions.service';
import { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { CreateShopSalaryRuleHandler } from '@/domains/shop/modules/accounting/application/command/create-shop-salary-rule.handler';
import { CreateShopMotivationSchemaHandler } from '@/domains/shop/modules/accounting/application/command/create-shop-motivation-schema.handler';
import { CreateShopTaskCompletionHandler } from '@/domains/shop/modules/accounting/application/command/create-shop-task-completion.handler';
import { ConfirmShopTaskCompletionHandler } from '@/domains/shop/modules/accounting/application/command/confirm-shop-task-completion.handler';
import { DeleteShopTaskCompletionHandler } from '@/domains/shop/modules/accounting/application/command/delete-shop-task-completion.handler';
import { ListShopSalaryRuleTypesHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/list-salary-rule-types.http.controller';
import { CreateShopMotivationSchemaHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/create-shop-motivation-schema.http.controller';
import { CreateShopTaskCompletionHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/create-shop-task-completion.http.controller';
import { ConfirmShopTaskCompletionHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/confirm-shop-task-completion.http.controller';
import { DeleteShopTaskCompletionHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/delete-shop-task-completion.http.controller';
import { ListShopTaskCompletionsHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/list-shop-task-completions.http.controller';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-rule.port';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import { ShopMotivationSchemaRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/shop-motivation-schema.repository';
import { ShopSalaryRuleRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/shop-salary-rule.repository';
import { ShopTaskCompletionRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/shop-task-completion.repository';
import { ShopCalculationDataRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/shop-calculation-data.repository';

// Модуль accounting магазина (Фазы 12/13, issue #57/#64, персистентность и
// оркестратор — Фаза 13.5, см.
// docs/payroll/phase-13.5-shop-report-integration.md) — собственный,
// независимый от одноимённого модуля сервиса (см.
// domains/service/modules/accounting/accounting.module.ts) набор
// провайдеров/контроллеров; ни один класс оттуда здесь не импортируется.
//
// CqrsModule — нужен командным хендлерам (CommandBus.execute внутри HTTP-
// контроллеров этого модуля). ShopSalesModule — источник
// SHOP_SALES_PERFORMANCE_READER, вход BuildShopCalculationContextService для
// FloatPercent (зеркало SalesModule в service-версии AccountingModule).
// MoySkladSyncModule — источник ProductFolderTreeService, которым
// ShopCalculationDataRepository раскрывает категорию правила до потомков.
//
// Пробел, ранее задокументированный здесь («BuildShopCalculationContextService
// не реализован, нет HTTP-пути записи»), закрыт этой фазой: собраны
// персистентность мотивационной схемы/правила/задачи магазина и оркестратор,
// реально строящий CalculationContext для направления shop. Экспортируемые
// токены/сервис потребляются AccountingModule сервиса (Фаза 13.5, следующий
// шаг) — единственная точка связи domains/service и domains/shop на уровне
// Nest DI, зеркало уже существующей зависимости ShopSalesModule →
// сервисные SalesPlanRepository/SalesPlanTemplateRepository в другую сторону.
@Module({
    imports: [CqrsModule, ShopSalesModule, MoySkladSyncModule],
    controllers: [
        ListShopSalaryRuleTypesHttpController,
        CreateShopMotivationSchemaHttpController,
        CreateShopTaskCompletionHttpController,
        ConfirmShopTaskCompletionHttpController,
        DeleteShopTaskCompletionHttpController,
        ListShopTaskCompletionsHttpController,
    ],
    providers: [
        ListShopSalaryRuleTypesService,
        CreateShopSalaryRuleHandler,
        CreateShopMotivationSchemaHandler,
        CreateShopTaskCompletionHandler,
        ConfirmShopTaskCompletionHandler,
        DeleteShopTaskCompletionHandler,
        ListShopTaskCompletionsService,
        BuildShopCalculationContextService,
        {
            provide: SHOP_MOTIVATION_SCHEMA_REPOSITORY,
            useClass: ShopMotivationSchemaRepository,
        },
        {
            provide: SHOP_SALARY_RULE_REPOSITORY,
            useClass: ShopSalaryRuleRepository,
        },
        {
            provide: SHOP_TASK_COMPLETION_REPOSITORY,
            useClass: ShopTaskCompletionRepository,
        },
        {
            provide: SHOP_CALCULATION_DATA,
            useClass: ShopCalculationDataRepository,
        },
    ],
    exports: [
        SHOP_MOTIVATION_SCHEMA_REPOSITORY,
        BuildShopCalculationContextService,
        SHOP_CALCULATION_DATA,
        // Nest не даёт реэкспортировать токен, которым модуль сам не
        // владеет (SHOP_SALES_PERFORMANCE_READER предоставлен ShopSalesModule,
        // а не этим модулем напрямую) — "Nest cannot export a
        // provider/module that is not a part of the currently processed
        // module". GetDepartmentSalaryReportService (сервисный
        // AccountingModule) инжектит SHOP_SALES_PERFORMANCE_READER
        // напрямую, поэтому реэкспортируем ShopSalesModule целиком, а не
        // голый токен — единственный экспорт ShopSalesModule и так этот же
        // токен (см. shop-sales.module.ts).
        ShopSalesModule,
    ],
})
export class ShopAccountingModule {}
