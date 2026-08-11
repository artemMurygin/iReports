import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SalesModule } from '@/domains/service/modules/sales/sales.module';
import { DomainSyncStatusModule } from '@/shared/infrastructure/domain-sync-status/domain-sync-status.module';
import { CreateMotivationSchemaHandler } from '@/domains/service/modules/accounting/application/command/create-motivation-schema.handler';
import { CreateSalaryRuleHandler } from '@/domains/service/modules/accounting/application/command/create-salary-rule.handler';
import { CloseAccountingPeriodHandler } from '@/domains/service/modules/accounting/application/command/close-accounting-period.handler';
import { ReopenAccountingPeriodHandler } from '@/domains/service/modules/accounting/application/command/reopen-accounting-period.handler';
import { RecalculateAccountingPeriodHandler } from '@/domains/service/modules/accounting/application/command/recalculate-accounting-period.handler';
import { CreateEmployeeHoursEntryHandler } from '@/domains/service/modules/accounting/application/command/create-employee-hours-entry.handler';
import { UpdateEmployeeHoursEntryHandler } from '@/domains/service/modules/accounting/application/command/update-employee-hours-entry.handler';
import { DeleteEmployeeHoursEntryHandler } from '@/domains/service/modules/accounting/application/command/delete-employee-hours-entry.handler';
import { CreateTaskCompletionHandler } from '@/domains/service/modules/accounting/application/command/create-task-completion.handler';
import { ConfirmTaskCompletionHandler } from '@/domains/service/modules/accounting/application/command/confirm-task-completion.handler';
import { DeleteTaskCompletionHandler } from '@/domains/service/modules/accounting/application/command/delete-task-completion.handler';
import { GetEmployeeSalaryReportService } from '@/domains/service/modules/accounting/application/services/get-employee-salary-report.service';
import { GetAccountingPeriodService } from '@/domains/service/modules/accounting/application/services/get-accounting-period.service';
import { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import { ListEmployeeHoursEntriesService } from '@/domains/service/modules/accounting/application/services/list-employee-hours-entries.service';
import { ListTaskCompletionsService } from '@/domains/service/modules/accounting/application/services/list-task-completions.service';
import { ListSalaryRuleTypesService } from '@/domains/service/modules/accounting/application/services/list-salary-rule-types.service';
import { CreateMotivationSchemaHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/create-motivation-schema.http.controller';
import { GetEmployeeSalaryReportHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-employee-salary-report.http.controller';
import { CloseAccountingPeriodHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/close-accounting-period.http.controller';
import { ReopenAccountingPeriodHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/reopen-accounting-period.http.controller';
import { RecalculateAccountingPeriodHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/recalculate-accounting-period.http.controller';
import { GetAccountingPeriodHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-accounting-period.http.controller';
import { CreateEmployeeHoursEntryHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/create-employee-hours-entry.http.controller';
import { UpdateEmployeeHoursEntryHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/update-employee-hours-entry.http.controller';
import { DeleteEmployeeHoursEntryHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/delete-employee-hours-entry.http.controller';
import { ListEmployeeHoursEntriesHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/list-employee-hours-entries.http.controller';
import { CreateTaskCompletionHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/create-task-completion.http.controller';
import { ConfirmTaskCompletionHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/confirm-task-completion.http.controller';
import { DeleteTaskCompletionHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/delete-task-completion.http.controller';
import { ListTaskCompletionsHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/list-task-completions.http.controller';
import { ListSalaryRuleTypesHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/list-salary-rule-types.http.controller';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { EMPLOYEE_HOURS_ENTRY_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { TASK_COMPLETION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/task-completion.port';
import { MotivationSchemaRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/motivation-schema.repository';
import { SalaryRuleRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-rule.repository';
import { AccountingPeriodRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-period.repository';
import { AccountingPeriodSnapshotRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-period-snapshot.repository';
import { AccountingCalculationCacheRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/accounting-calculation-cache.repository';
import { EmployeeHoursEntryRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/employee-hours-entry.repository';
import { ServiceCalculationDataRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/service-calculation-data.repository';
import { TaskCompletionRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/task-completion.repository';
import { MotivationSchemaCreatedEventHandler } from '@/domains/service/modules/accounting/application/events/motivation-schema-created.event-handler';
import { AccountingPeriodClosedEventHandler } from '@/domains/service/modules/accounting/application/events/accounting-period-closed.event-handler';

// SalesModule — вход SALES_PLAN_REPOSITORY: закрытие периода читает
// неутверждённые строки плана (CloseAccountingPeriodHandler), а ленивый
// кэш — их updatedAt как один из трёх штампов свежести (Фаза 6, см.
// GetEmployeeSalaryReportService и domain/services/accounting-cache-freshness.ts).
// Фаза 8 добавляет второй вход из SalesModule — SALES_PERFORMANCE_READER
// (BuildServiceCalculationContextService, вход FloatPercent).
// DomainSyncStatusModule — второй штамп свежести, общий с будущим
// синком shop.
@Module({
    imports: [CqrsModule, SalesModule, DomainSyncStatusModule],
    controllers: [
        CreateMotivationSchemaHttpController,
        GetEmployeeSalaryReportHttpController,
        CloseAccountingPeriodHttpController,
        ReopenAccountingPeriodHttpController,
        RecalculateAccountingPeriodHttpController,
        GetAccountingPeriodHttpController,
        CreateEmployeeHoursEntryHttpController,
        UpdateEmployeeHoursEntryHttpController,
        DeleteEmployeeHoursEntryHttpController,
        ListEmployeeHoursEntriesHttpController,
        CreateTaskCompletionHttpController,
        ConfirmTaskCompletionHttpController,
        DeleteTaskCompletionHttpController,
        ListTaskCompletionsHttpController,
        ListSalaryRuleTypesHttpController,
    ],
    providers: [
        CreateMotivationSchemaHandler,
        CreateSalaryRuleHandler,
        CloseAccountingPeriodHandler,
        ReopenAccountingPeriodHandler,
        RecalculateAccountingPeriodHandler,
        CreateEmployeeHoursEntryHandler,
        UpdateEmployeeHoursEntryHandler,
        DeleteEmployeeHoursEntryHandler,
        CreateTaskCompletionHandler,
        ConfirmTaskCompletionHandler,
        DeleteTaskCompletionHandler,
        GetEmployeeSalaryReportService,
        GetAccountingPeriodService,
        BuildServiceCalculationContextService,
        ListEmployeeHoursEntriesService,
        ListTaskCompletionsService,
        ListSalaryRuleTypesService,
        MotivationSchemaCreatedEventHandler,
        AccountingPeriodClosedEventHandler,
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
            provide: EMPLOYEE_HOURS_ENTRY_REPOSITORY,
            useClass: EmployeeHoursEntryRepository,
        },
        {
            provide: SERVICE_CALCULATION_DATA,
            useClass: ServiceCalculationDataRepository,
        },
        {
            provide: TASK_COMPLETION_REPOSITORY,
            useClass: TaskCompletionRepository,
        },
    ],
})
export class AccountingModule {}
