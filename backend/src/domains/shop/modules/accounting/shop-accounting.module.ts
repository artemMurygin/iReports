import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ShopSalesModule } from '@/domains/shop/modules/sales/shop-sales.module';
import { MoySkladSyncModule } from '@/domains/shop/sync/moySklad/moysklad-sync.module';
import { DomainSyncStatusModule } from '@/shared/infrastructure/domain-sync-status/domain-sync-status.module';
import { DirectoryModule } from '@/modules/directory/directory.module';
import { ListShopSalaryRuleTypesService } from '@/domains/shop/modules/accounting/application/services/list-salary-rule-types.service';
import { ListShopTaskCompletionsService } from '@/domains/shop/modules/accounting/application/services/list-shop-task-completions.service';
import { ListShopMotivationSchemasService } from '@/domains/shop/modules/accounting/application/services/list-shop-motivation-schemas.service';
import { GetShopMotivationSchemaService } from '@/domains/shop/modules/accounting/application/services/get-shop-motivation-schema.service';
import { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/resolve-shop-employee-salary-rules.service';
import { GetShopEmployeeSalaryReportService } from '@/domains/shop/modules/accounting/application/services/get-shop-employee-salary-report.service';
import { GetShopDepartmentSalaryReportService } from '@/domains/shop/modules/accounting/application/services/get-shop-department-salary-report.service';
import { CreateShopSalaryRuleHandler } from '@/domains/shop/modules/accounting/application/command/create-shop-salary-rule.handler';
import { CreateShopMotivationSchemaHandler } from '@/domains/shop/modules/accounting/application/command/create-shop-motivation-schema.handler';
import { UpdateShopMotivationSchemaHandler } from '@/domains/shop/modules/accounting/application/command/update-shop-motivation-schema.handler';
import { CreateShopTaskCompletionHandler } from '@/domains/shop/modules/accounting/application/command/create-shop-task-completion.handler';
import { ConfirmShopTaskCompletionHandler } from '@/domains/shop/modules/accounting/application/command/confirm-shop-task-completion.handler';
import { DeleteShopTaskCompletionHandler } from '@/domains/shop/modules/accounting/application/command/delete-shop-task-completion.handler';
import { CalculateShopSnapshotRowsService } from '@/domains/shop/modules/accounting/application/services/calculate-shop-snapshot-rows.service';
import { MoySkladErpPeriodSyncAdapter } from '@/domains/shop/modules/accounting/infrastructure/sync/moysklad-erp-period-sync.adapter';
import { GetShopClosePeriodPreviewHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/get-shop-close-period-preview.http.controller';
import { CloseShopAccountingPeriodHandler } from '@/domains/shop/modules/accounting/application/command/close-shop-accounting-period.handler';
import { ListShopSalaryRuleTypesHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/list-salary-rule-types.http.controller';
import { CreateShopMotivationSchemaHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/create-shop-motivation-schema.http.controller';
import { ListShopMotivationSchemasHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/list-shop-motivation-schemas.http.controller';
import { GetShopMotivationSchemaHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/get-shop-motivation-schema.http.controller';
import { UpdateShopMotivationSchemaHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/update-shop-motivation-schema.http.controller';
import { CreateShopTaskCompletionHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/create-shop-task-completion.http.controller';
import { ConfirmShopTaskCompletionHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/confirm-shop-task-completion.http.controller';
import { DeleteShopTaskCompletionHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/delete-shop-task-completion.http.controller';
import { ListShopTaskCompletionsHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/list-shop-task-completions.http.controller';
import { GetShopAccountingPeriodHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/get-shop-accounting-period.http.controller';
import { ReopenShopAccountingPeriodHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/reopen-shop-accounting-period.http.controller';
import { RecalculateShopAccountingPeriodHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/recalculate-shop-accounting-period.http.controller';
import { CloseShopAccountingPeriodHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/close-shop-accounting-period.http.controller';
import { GetShopEmployeeSalaryReportHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/get-shop-employee-salary-report.http.controller';
import { GetShopDepartmentSalaryReportHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/get-shop-department-salary-report.http.controller';
import { ListShopSalaryAccrualsHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/list-shop-salary-accruals.http.controller';
import { GetShopSalaryAccrualHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/get-shop-salary-accrual.http.controller';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-rule.port';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import { ShopMotivationSchemaRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/shop-motivation-schema.repository';
import { ShopSalaryRuleRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/shop-salary-rule.repository';
import { ShopTaskCompletionRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/shop-task-completion.repository';
import { ShopCalculationDataRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/shop-calculation-data.repository';
import { GetAccountingPeriodService } from '@/domains/service/modules/accounting/application/services/get-accounting-period.service';
import { ListSalaryAccrualsService } from '@/domains/service/modules/accounting/application/services/list-salary-accruals.service';
import { GetSalaryAccrualService } from '@/domains/service/modules/accounting/application/services/get-salary-accrual.service';
import { GetClosePeriodPreviewService } from '@/domains/service/modules/accounting/application/services/get-close-period-preview.service';
import { ErpPeriodSyncRunner } from '@/domains/service/modules/accounting/application/services/erp-period-sync-runner.service';
import { ERP_PERIOD_SYNC } from '@/domains/service/modules/accounting/application/ports/erp-period-sync.port';
import { SNAPSHOT_ROWS_CALCULATOR } from '@/domains/service/modules/accounting/application/ports/snapshot-rows-calculator.port';
import { EMPLOYEE_HOURS_ENTRY_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import { EmployeeHoursEntryRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/employee-hours-entry.repository';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { EMPLOYEE_DISMISSAL } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import { SalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual.repository';
import { EmployeeDismissalRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/employee-dismissal.repository';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { AccountingPeriodRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-period.repository';
import { AccountingPeriodSnapshotRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-period-snapshot.repository';
import { AccountingCalculationCacheRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-calculation-cache.repository';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SalesPlanRepository } from '@/domains/service/modules/sales/infrastructure/repositories/sales-plan.repository';

// Модуль accounting магазина (Фазы 12/13, issue #57/#64, персистентность и
// оркестратор — Фаза 13.5, см.
// docs/payroll/phase-13.5-shop-report-integration.md) — собственный,
// независимый от одноимённого модуля сервиса (см.
// domains/service/modules/accounting/accounting.module.ts) набор
// провайдеров/контроллеров бизнес-логики магазина; единственное исключение —
// расчётный период (Фаза 3, см. комментарий ниже), где переиспользуются
// direction-агностичные класс/токены сервисного accounting напрямую.
//
// CqrsModule — нужен командным хендлерам (CommandBus.execute внутри HTTP-
// контроллеров этого модуля). ShopSalesModule — источник
// SHOP_SALES_PERFORMANCE_READER, вход BuildShopCalculationContextService для
// FloatPercent (зеркало SalesModule в service-версии AccountingModule).
// MoySkladSyncModule — источник ProductFolderTreeService, которым
// ShopCalculationDataRepository раскрывает категорию правила до потомков.
// DomainSyncStatusModule — второй штамп свежести ленивого кэша (см.
// GetShopEmployeeSalaryReportService/GetShopDepartmentSalaryReportService
// ниже), тот же приём, что и у AccountingModule сервиса.
//
// Пробел, ранее задокументированный здесь («BuildShopCalculationContextService
// не реализован, нет HTTP-пути записи»), закрыт этой фазой: собраны
// персистентность мотивационной схемы/правила/задачи магазина и оркестратор,
// реально строящий CalculationContext для направления shop. Экспортируемые
// токены (SHOP_MOTIVATION_SCHEMA_REPOSITORY/BuildShopCalculationContextService/
// SHOP_CALCULATION_DATA/ShopSalesModule) исторически потреблялись сервисным
// AccountingModule (Фаза 13.5) — после разбора объединённого зарплатного
// отчёта (Фаза 4, см. domains/service/CLAUDE.md, раздел «Отчёты») этот
// импорт удалён: GetEmployeeSalaryReportService/GetDepartmentSalaryReportService
// стали строго однонаправленными и больше не инжектируют ни один SHOP_*-
// токен. Экспорты оставлены (не используются сейчас никем извне модуля) —
// удалять не обязательно, они не создают связности, раз их никто не
// импортирует.
//
// Отчёты по зарплате магазина (Фаза 4 разбора shop-report-integration,
// см. GetShopEmployeeSalaryReportService/GetShopDepartmentSalaryReportService)
// — собственные, не direction-aware сервисы (в отличие от
// GetEmployeeSalaryReportService/GetDepartmentSalaryReportService домена
// service, которые сводят оба направления в один ответ): ответ контракта
// односторонний, поэтому объединять два отчёта на уровне сервиса незачем.
// SALES_PLAN_REPOSITORY — третий штамп свежести ленивого кэша (обновление
// плана продаж инвалидирует кэш); собственный экземпляр под тем же токеном,
// что и в SalesModule/ShopSalesModule/AccountingModule сервиса — тот же
// приём, что уже применён для ACCOUNTING_PERIOD_*/ACCOUNTING_CALCULATION_CACHE
// выше (SALES_PLAN_REPOSITORY, предоставленный ShopSalesModule, не
// экспортируется этим модулем — см. shop-sales.module.ts).
//
// Расчётный период направления shop (Фаза 3, close/reopen/recalculate/get,
// см. routesV1.shop.accounting.period в app.routes.ts): CloseShopAccountingPeriodHandler
// и GetAccountingPeriodService (переиспользован как класс, не как отдельный
// shop-сервис — он уже generic по direction) нуждаются в
// ACCOUNTING_PERIOD_REPOSITORY/ACCOUNTING_PERIOD_SNAPSHOT/ACCOUNTING_CALCULATION_CACHE
// — эти токены физически объявлены в domains/service/modules/accounting, но
// сами реализации (Prisma-репозитории) не содержат service-специфичной
// логики (ключ — направление+период, то же самое, что уже верно для
// AccountingPeriod, см. CloseShopAccountingPeriodHandler). Импортировать сюда
// сам AccountingModule сервиса ради этих токенов избыточно — они не
// service-специфичны, а Nest DI не делит провайдеров между модулями без
// явного экспорта/импорта. Поэтому здесь заведены собственные экземпляры тех
// же классов под теми же токенами — ровно тот же приём, что уже применён в
// ShopSalesModule для SALES_PLAN_REPOSITORY/SALES_PLAN_TEMPLATE_REPOSITORY
// (переиспользование generic-по-direction класса сервиса отдельным
// провайдером в модуле shop, а не через экспорт/импорт модуля).
// Reopen/RecalculateAccountingPeriodHandler сюда не переезжают — это уже
// CQRS CommandHandler'ы, зарегистрированные в AccountingModule сервиса, а
// CommandBus общий на всё приложение (CqrsModule — тот же класс что и там),
// поэтому ReopenShopAccountingPeriodHttpController/
// RecalculateShopAccountingPeriodHttpController просто диспатчат те же
// команды через CommandBus без дублирования хендлеров.
@Module({
    imports: [
        CqrsModule,
        ShopSalesModule,
        MoySkladSyncModule,
        DomainSyncStatusModule,
        // Справочник Bitrix (отделы/сотрудники) — вход
        // ListShopMotivationSchemasService/GetShopMotivationSchemaService для
        // резолвинга target.name (Фаза "Редактирование зарплатных схем", тот
        // же приём, что и у одноимённого AccountingModule сервиса).
        DirectoryModule,
    ],
    controllers: [
        ListShopSalaryRuleTypesHttpController,
        CreateShopMotivationSchemaHttpController,
        ListShopMotivationSchemasHttpController,
        GetShopMotivationSchemaHttpController,
        UpdateShopMotivationSchemaHttpController,
        CreateShopTaskCompletionHttpController,
        ConfirmShopTaskCompletionHttpController,
        DeleteShopTaskCompletionHttpController,
        ListShopTaskCompletionsHttpController,
        GetShopAccountingPeriodHttpController,
        ReopenShopAccountingPeriodHttpController,
        RecalculateShopAccountingPeriodHttpController,
        CloseShopAccountingPeriodHttpController,
        GetShopEmployeeSalaryReportHttpController,
        GetShopDepartmentSalaryReportHttpController,
        ListShopSalaryAccrualsHttpController,
        GetShopSalaryAccrualHttpController,
        GetShopClosePeriodPreviewHttpController,
    ],
    providers: [
        ListShopSalaryRuleTypesService,
        CreateShopSalaryRuleHandler,
        CreateShopMotivationSchemaHandler,
        UpdateShopMotivationSchemaHandler,
        ListShopMotivationSchemasService,
        GetShopMotivationSchemaService,
        CreateShopTaskCompletionHandler,
        ConfirmShopTaskCompletionHandler,
        DeleteShopTaskCompletionHandler,
        ListShopTaskCompletionsService,
        BuildShopCalculationContextService,
        ResolveShopEmployeeSalaryRulesService,
        CloseShopAccountingPeriodHandler,
        GetAccountingPeriodService,
        // Фаза 2 PRD 1: калькулятор строк снапшота (общий для закрытия и
        // close-preview), синк отгрузок МойСклада за месяц по требованию и
        // generic-по-direction сводка закрытия — свои экземпляры под теми
        // же direction-агностичными токенами, что и в AccountingModule.
        CalculateShopSnapshotRowsService,
        ErpPeriodSyncRunner,
        GetClosePeriodPreviewService,
        {
            provide: SNAPSHOT_ROWS_CALCULATOR,
            useExisting: CalculateShopSnapshotRowsService,
        },
        {
            provide: ERP_PERIOD_SYNC,
            useClass: MoySkladErpPeriodSyncAdapter,
        },
        // Часы (EmployeeHoursEntry) — общий для направлений источник
        // PayPerHour; здесь только чтение для employeesWithoutHours.
        {
            provide: EMPLOYEE_HOURS_ENTRY_REPOSITORY,
            useClass: EmployeeHoursEntryRepository,
        },
        // Документы начисления (PRD 1 docs/payroll-closing-and-accrual) —
        // generic-по-direction сервисы чтения и direction-агностичные
        // реализации портов, собственные экземпляры под теми же токенами
        // (тот же приём, что и у ACCOUNTING_PERIOD_* ниже).
        ListSalaryAccrualsService,
        GetSalaryAccrualService,
        GetShopEmployeeSalaryReportService,
        GetShopDepartmentSalaryReportService,
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
        // Собственные экземпляры (см. комментарий выше) — те же токены,
        // что и в AccountingModule сервиса, реализация тоже та же
        // Prisma-based класс, ключ direction+period.
        {
            provide: ACCOUNTING_PERIOD_REPOSITORY,
            useClass: AccountingPeriodRepository,
        },
        {
            provide: ACCOUNTING_PERIOD_SNAPSHOT,
            useClass: AccountingPeriodSnapshotRepository,
        },
        {
            provide: ACCOUNTING_CALCULATION_CACHE,
            useClass: AccountingCalculationCacheRepository,
        },
        {
            provide: SALES_PLAN_REPOSITORY,
            useClass: SalesPlanRepository,
        },
        {
            provide: SALARY_ACCRUAL_REPOSITORY,
            useClass: SalaryAccrualRepository,
        },
        {
            provide: EMPLOYEE_DISMISSAL,
            useClass: EmployeeDismissalRepository,
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
