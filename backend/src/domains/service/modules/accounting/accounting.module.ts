import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SalesModule } from '@/domains/service/modules/sales/sales.module';
import { DomainSyncStatusModule } from '@/shared/infrastructure/domain-sync-status/domain-sync-status.module';
import { DirectoryModule } from '@/modules/directory/directory.module';
import { RoappSyncModule } from '@/domains/service/sync/roapp/roapp-sync.module';
import { CreateMotivationSchemaHandler } from '@/domains/service/modules/accounting/application/command/create-motivation-schema.handler';
import { UpdateMotivationSchemaHandler } from '@/domains/service/modules/accounting/application/command/update-motivation-schema.handler';
import { CreateSalaryRuleHandler } from '@/domains/service/modules/accounting/application/command/create-salary-rule.handler';
import { CloseAccountingPeriodHandler } from '@/domains/service/modules/accounting/application/command/close-accounting-period.handler';
import { ReopenAccountingPeriodHandler } from '@/domains/service/modules/accounting/application/command/reopen-accounting-period.handler';
import { AccrueSalaryAccrualLineHandler } from '@/domains/service/modules/accounting/application/command/accrue-salary-accrual-line.handler';
import { UnaccrueSalaryAccrualLineHandler } from '@/domains/service/modules/accounting/application/command/unaccrue-salary-accrual-line.handler';
import { AdjustSalaryAccrualLineHandler } from '@/domains/service/modules/accounting/application/command/adjust-salary-accrual-line.handler';
import { AccrueSalaryAccrualDocumentHandler } from '@/domains/service/modules/accounting/application/command/accrue-salary-accrual-document.handler';
import { AccruePeriodSalaryAccrualsHandler } from '@/domains/service/modules/accounting/application/command/accrue-period-salary-accruals.handler';
import { CreateBalanceTransactionHandler } from '@/domains/service/modules/accounting/application/command/create-balance-transaction.handler';
import { ReverseBalanceTransactionHandler } from '@/domains/service/modules/accounting/application/command/reverse-balance-transaction.handler';
import { RecalculateAccountingPeriodHandler } from '@/domains/service/modules/accounting/application/command/recalculate-accounting-period.handler';
import { CreateTaskCompletionHandler } from '@/domains/service/modules/accounting/application/command/create-task-completion.handler';
import { ConfirmTaskCompletionHandler } from '@/domains/service/modules/accounting/application/command/confirm-task-completion.handler';
import { DeleteTaskCompletionHandler } from '@/domains/service/modules/accounting/application/command/delete-task-completion.handler';
import { GetEmployeeSalaryReportService } from '@/domains/service/modules/accounting/application/services/get-employee-salary-report.service';
import { GetDepartmentSalaryReportService } from '@/domains/service/modules/accounting/application/services/get-department-salary-report.service';
import { GetAccountingPeriodService } from '@/domains/service/modules/accounting/application/services/get-accounting-period.service';
import { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { ListTaskCompletionsService } from '@/domains/service/modules/accounting/application/services/list-task-completions.service';
import { ListSalaryRuleTypesService } from '@/domains/service/modules/accounting/application/services/list-salary-rule-types.service';
import { ListMotivationSchemasService } from '@/domains/service/modules/accounting/application/services/list-motivation-schemas.service';
import { GetMotivationSchemaService } from '@/domains/service/modules/accounting/application/services/get-motivation-schema.service';
import { ListSalaryAccrualsService } from '@/domains/service/modules/accounting/application/services/list-salary-accruals.service';
import { GetSalaryAccrualService } from '@/domains/service/modules/accounting/application/services/get-salary-accrual.service';
import { GetEmployeeBalanceService } from '@/domains/service/modules/accounting/application/services/get-employee-balance.service';
import { GetDepartmentBalancesService } from '@/domains/service/modules/accounting/application/services/get-department-balances.service';
import { GetClosePeriodPreviewService } from '@/domains/service/modules/accounting/application/services/get-close-period-preview.service';
import { CalculateServiceSnapshotRowsService } from '@/domains/service/modules/accounting/application/services/calculate-service-snapshot-rows.service';
import { ErpPeriodSyncRunner } from '@/domains/service/modules/accounting/application/services/erp-period-sync-runner.service';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import { WorkScheduleEntryRepository } from '@/modules/work-schedule/infrastructure/repositories/work-schedule-entry.repository';
import { CreateMotivationSchemaHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/create-motivation-schema.http.controller';
import { ListMotivationSchemasHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/list-motivation-schemas.http.controller';
import { GetMotivationSchemaHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-motivation-schema.http.controller';
import { UpdateMotivationSchemaHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/update-motivation-schema.http.controller';
import { GetEmployeeSalaryReportHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-employee-salary-report.http.controller';
import { GetDepartmentSalaryReportHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-department-salary-report.http.controller';
import { CloseAccountingPeriodHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/close-accounting-period.http.controller';
import { ReopenAccountingPeriodHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/reopen-accounting-period.http.controller';
import { RecalculateAccountingPeriodHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/recalculate-accounting-period.http.controller';
import { GetAccountingPeriodHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-accounting-period.http.controller';
import { CreateTaskCompletionHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/create-task-completion.http.controller';
import { ConfirmTaskCompletionHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/confirm-task-completion.http.controller';
import { DeleteTaskCompletionHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/delete-task-completion.http.controller';
import { ListTaskCompletionsHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/list-task-completions.http.controller';
import { ListSalaryRuleTypesHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/list-salary-rule-types.http.controller';
import { ListSalaryAccrualsHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/list-salary-accruals.http.controller';
import { GetSalaryAccrualHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-salary-accrual.http.controller';
import { AccrueSalaryAccrualLineHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/accrue-salary-accrual-line.http.controller';
import { UnaccrueSalaryAccrualLineHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/unaccrue-salary-accrual-line.http.controller';
import { AdjustSalaryAccrualLineHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/adjust-salary-accrual-line.http.controller';
import { GetEmployeeBalanceHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-employee-balance.http.controller';
import { AccrueSalaryAccrualDocumentHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/accrue-salary-accrual-document.http.controller';
import { AccruePeriodSalaryAccrualsHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/accrue-period-salary-accruals.http.controller';
import { CreateBalanceTransactionHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/create-balance-transaction.http.controller';
import { ReverseBalanceTransactionHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/reverse-balance-transaction.http.controller';
import { GetDepartmentBalancesHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-department-balances.http.controller';
import { GetClosePeriodPreviewHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-close-period-preview.http.controller';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { TASK_COMPLETION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { EMPLOYEE_DISMISSAL } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import { ERP_PERIOD_SYNC } from '@/domains/service/modules/accounting/application/ports/erp-period-sync.port';
import { SNAPSHOT_ROWS_CALCULATOR } from '@/domains/service/modules/accounting/application/ports/snapshot-rows-calculator.port';
import { MotivationSchemaRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/motivation-schema.repository';
import { SalaryRuleRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-rule.repository';
import { AccountingPeriodRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-period.repository';
import { AccountingPeriodSnapshotRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-period-snapshot.repository';
import { AccountingCalculationCacheRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-calculation-cache.repository';
import { ServiceCalculationDataRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/service-calculation-data.repository';
import { TaskCompletionRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/task-completion.repository';
import { SalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual.repository';
import { BalanceTransactionRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/balance-transaction.repository';
import { EmployeeDismissalRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/employee-dismissal.repository';
import { RoappErpPeriodSyncAdapter } from '@/domains/service/modules/accounting/infrastructure/sync/roapp-erp-period-sync.adapter';
import { MotivationSchemaCreatedEventHandler } from '@/domains/service/modules/accounting/application/events/motivation-schema-created.event-handler';
import { AccountingPeriodClosedEventHandler } from '@/domains/service/modules/accounting/application/events/accounting-period-closed.event-handler';
import { SalaryAccrualDocumentsCreatedEventHandler } from '@/domains/service/modules/accounting/application/events/salary-accrual-documents-created.event-handler';

// SalesModule — вход SALES_PLAN_REPOSITORY: закрытие периода читает
// неутверждённые строки плана (CloseAccountingPeriodHandler), а ленивый
// кэш — их updatedAt как один из трёх штампов свежести (Фаза 6, см.
// GetEmployeeSalaryReportService и domain/services/accounting-cache-freshness.ts).
// Фаза 8 добавляет второй вход из SalesModule — SALES_PERFORMANCE_READER
// (BuildServiceCalculationContextService, вход FloatPercent).
// DomainSyncStatusModule — второй штамп свежести, общий с будущим
// синком shop.
//
// ShopAccountingModule (Фаза 13.5) здесь больше НЕ импортируется: это был
// единственный (санкционированный, см. backend/CLAUDE.md) уровень связи
// domains/service ↔ domains/shop на уровне Nest DI, нужный только ради
// экспортируемых токенов SHOP_MOTIVATION_SCHEMA_REPOSITORY/
// BuildShopCalculationContextService/SHOP_CALCULATION_DATA/
// SHOP_SALES_PERFORMANCE_READER для GetEmployeeSalaryReportService/
// GetDepartmentSalaryReportService, которые раньше сводили оба направления
// в один ответ. После разбора объединённого отчёта (Фаза 4,
// shop-report-integration.e2e.spec.ts) оба сервиса стали строго
// однонаправленными (только service) и ни один SHOP_*-токен больше не
// инжектируют — импорт стал мёртвым весом и удалён. Аналогичный отчёт
// направления shop — независимый GetShopEmployeeSalaryReportService/
// GetShopDepartmentSalaryReportService в самом ShopAccountingModule (см.
// domains/shop/CLAUDE.md).
//
// Итог: кросс-доменная связь domains/service ↔ domains/shop на уровне Nest DI
// в этом модуле полностью устранена — ни один провайдер/контроллер ниже не
// импортирует и не инжектирует ничего из domains/shop, проверено
// `grep -rn "domains/shop\|SHOP_" accounting --include=*.ts | grep -v spec`
// (единственные совпадения — этот комментарий и аналогичный комментарий в
// get-employee-salary-report.service.ts, оба чисто документационные, не
// импорты). Не путай с close-accounting-period.direction-independence.spec.ts
// — это регрессионный тест, который намеренно и легитимно импортирует классы
// shop напрямую (без прохода через DI ShopAccountingModule), чтобы проверить
// независимость закрытия периода по direction; на providers/controllers/
// imports этого модуля он не влияет.
@Module({
    // RoappSyncModule — вход RoappErpPeriodSyncAdapter (ERP_PERIOD_SYNC):
    // неявная синхронизация заказов RemOnline за месяц внутри закрытия
    // периода (PRD 1 docs/payroll-closing-and-accrual, Фаза 2).
    imports: [
        CqrsModule,
        SalesModule,
        DomainSyncStatusModule,
        DirectoryModule,
        RoappSyncModule,
    ],
    controllers: [
        CreateMotivationSchemaHttpController,
        ListMotivationSchemasHttpController,
        GetMotivationSchemaHttpController,
        UpdateMotivationSchemaHttpController,
        GetEmployeeSalaryReportHttpController,
        GetDepartmentSalaryReportHttpController,
        CloseAccountingPeriodHttpController,
        ReopenAccountingPeriodHttpController,
        RecalculateAccountingPeriodHttpController,
        GetAccountingPeriodHttpController,
        CreateTaskCompletionHttpController,
        ConfirmTaskCompletionHttpController,
        DeleteTaskCompletionHttpController,
        ListTaskCompletionsHttpController,
        ListSalaryRuleTypesHttpController,
        ListSalaryAccrualsHttpController,
        GetSalaryAccrualHttpController,
        AccrueSalaryAccrualLineHttpController,
        UnaccrueSalaryAccrualLineHttpController,
        AdjustSalaryAccrualLineHttpController,
        // Массовое проведение, ручные движения, сторно и сводка отдела
        // (PRD 2, Фаза 7).
        AccrueSalaryAccrualDocumentHttpController,
        AccruePeriodSalaryAccrualsHttpController,
        CreateBalanceTransactionHttpController,
        ReverseBalanceTransactionHttpController,
        GetDepartmentBalancesHttpController,
        GetEmployeeBalanceHttpController,
        GetClosePeriodPreviewHttpController,
    ],
    providers: [
        CreateMotivationSchemaHandler,
        UpdateMotivationSchemaHandler,
        ListMotivationSchemasService,
        GetMotivationSchemaService,
        CreateSalaryRuleHandler,
        CloseAccountingPeriodHandler,
        ReopenAccountingPeriodHandler,
        RecalculateAccountingPeriodHandler,
        // Проведение/отмена/корректировка строк документов начисления
        // (PRD 2, Фаза 6) — generic по direction CQRS-хендлеры,
        // зарегистрированные здесь один раз на общий CommandBus;
        // контроллеры shop диспатчат те же команды (тот же приём, что
        // Reopen/RecalculateAccountingPeriodHandler).
        AccrueSalaryAccrualLineHandler,
        UnaccrueSalaryAccrualLineHandler,
        AdjustSalaryAccrualLineHandler,
        // Фаза 7 PRD 2: массовое проведение (построчно через диспатч
        // AccrueSalaryAccrualLineCommand — своя транзакция на строку),
        // ручные движения и сторно — те же generic по direction хендлеры
        // на общем CommandBus.
        AccrueSalaryAccrualDocumentHandler,
        AccruePeriodSalaryAccrualsHandler,
        CreateBalanceTransactionHandler,
        ReverseBalanceTransactionHandler,
        CreateTaskCompletionHandler,
        ConfirmTaskCompletionHandler,
        DeleteTaskCompletionHandler,
        GetEmployeeSalaryReportService,
        GetDepartmentSalaryReportService,
        GetAccountingPeriodService,
        BuildServiceCalculationContextService,
        ResolveEmployeeSalaryRulesService,
        ListTaskCompletionsService,
        ListSalaryRuleTypesService,
        ListSalaryAccrualsService,
        GetSalaryAccrualService,
        GetEmployeeBalanceService,
        GetDepartmentBalancesService,
        GetClosePeriodPreviewService,
        CalculateServiceSnapshotRowsService,
        ErpPeriodSyncRunner,
        EnsurePeriodNotClosedService,
        MotivationSchemaCreatedEventHandler,
        AccountingPeriodClosedEventHandler,
        SalaryAccrualDocumentsCreatedEventHandler,
        {
            provide: MOTIVATION_SCHEMA_REPOSITORY,
            useClass: MotivationSchemaRepository,
        },
        {
            provide: SALARY_RULE_REPOSITORY,
            useClass: SalaryRuleRepository,
        },
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
            provide: SERVICE_CALCULATION_DATA,
            useClass: ServiceCalculationDataRepository,
        },
        {
            provide: TASK_COMPLETION_REPOSITORY,
            useClass: TaskCompletionRepository,
        },
        // Документы начисления (PRD 1 docs/payroll-closing-and-accrual) и
        // признак увольнения для них — direction-агностичные реализации,
        // ShopAccountingModule заводит собственные экземпляры под теми же
        // токенами (см. комментарий там).
        {
            provide: SALARY_ACCRUAL_REPOSITORY,
            useClass: SalaryAccrualRepository,
        },
        // Лента баланса сотрудника (PRD 2, Фаза 6) — direction-агностичная
        // реализация, как SalaryAccrualRepository.
        {
            provide: BALANCE_TRANSACTION_REPOSITORY,
            useClass: BalanceTransactionRepository,
        },
        {
            provide: EMPLOYEE_DISMISSAL,
            useClass: EmployeeDismissalRepository,
        },
        // Фаза 2 PRD 1: калькулятор строк снапшота (общий для закрытия и
        // close-preview) и синк ERP месяца по требованию — свои реализации
        // направления под direction-агностичными токенами.
        {
            provide: SNAPSHOT_ROWS_CALCULATOR,
            useExisting: CalculateServiceSnapshotRowsService,
        },
        {
            provide: ERP_PERIOD_SYNC,
            useClass: RoappErpPeriodSyncAdapter,
        },
        // GetClosePeriodPreviewService (employeesWithoutHours) — свой
        // экземпляр под тем же токеном, что и в WorkScheduleModule/
        // ShopAccountingModule (см. domains/shop/CLAUDE.md), а не импорт
        // WorkScheduleModule целиком ради одного токена.
        {
            provide: WORK_SCHEDULE_ENTRY_REPOSITORY,
            useClass: WorkScheduleEntryRepository,
        },
    ],
})
export class AccountingModule {}
