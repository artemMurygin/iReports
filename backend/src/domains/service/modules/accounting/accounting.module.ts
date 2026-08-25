import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SalesModule } from '@/domains/service/modules/sales/sales.module';
import { DomainSyncStatusModule } from '@/shared/infrastructure/domain-sync-status/domain-sync-status.module';
import { DirectoryModule } from '@/modules/directory/directory.module';
import { RoappSyncModule } from '@/domains/service/sync/roapp/roapp-sync.module';
import { RoappModule } from '@/domains/service/integrations/roapp/roapp.module';
import { RoappCashDocumentAdapter } from '@/domains/service/integrations/roapp/roapp-cash-document.adapter';
// MoyskladModule/MoyskladCashDocumentAdapter (PRD 3, Фаза 12) — см. WHY у
// SHOP_ERP_CASH_DOCUMENT_PORT в providers ниже: единственная причина этого
// импорта из domains/shop в модуль domains/service.
import { MoyskladModule } from '@/domains/shop/integrations/moySklad/moysklad.module';
import { MoyskladCashDocumentAdapter } from '@/domains/shop/integrations/moySklad/moysklad-cash-document.adapter';
import { EmployeeIdentityRepository } from '@/modules/employee-identity/infrastructure/repositories/employee-identity.repository';
import { EmployeeOperationLockModule } from '@/shared/infrastructure/sync-lock/employee-operation-lock.module';
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
import { DeleteBalanceTransactionHandler } from '@/domains/service/modules/accounting/application/command/delete-balance-transaction.handler';
import { CreatePayoutHandler } from '@/domains/service/modules/accounting/application/command/create-payout.handler';
import { CreatePayoutBatchHandler } from '@/domains/service/modules/accounting/application/command/create-payout-batch.handler';
import { DeletePayoutHandler } from '@/domains/service/modules/accounting/application/command/delete-payout.handler';
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
import { GetErpCashConfigService } from '@/domains/service/modules/accounting/application/services/get-erp-cash-config.service';
import { GetDepartmentBalancesService } from '@/domains/service/modules/accounting/application/services/get-department-balances.service';
import { GetPayoutPageService } from '@/domains/service/modules/accounting/application/services/get-payout-page.service';
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
import { DeleteBalanceTransactionHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/delete-balance-transaction.http.controller';
import { CreatePayoutHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/create-payout.http.controller';
import { CreatePayoutBatchHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/create-payout-batch.http.controller';
import { GetPayoutPageHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-payout-page.http.controller';
import { DeletePayoutHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/delete-payout.http.controller';
import { GetDepartmentBalancesHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-department-balances.http.controller';
import { GetClosePeriodPreviewHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-close-period-preview.http.controller';
import { GetErpCashConfigHttpController } from '@/domains/service/modules/accounting/interface/http-controllers/get-erp-cash-config.http.controller';
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
import { ERP_CASH_CONFIG_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import { ERP_CASH_DOCUMENT_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import { SERVICE_ERP_CASH_DOCUMENT_PORT } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '@/modules/employee-identity/application/ports/employee-identity.port';
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
import { ErpCashConfigProvider } from '@/domains/service/modules/accounting/infrastructure/config/erp-cash-config.provider';
import { ErpCashDocumentRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/erp-cash-document.repository';
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
// Итог на момент Фазы 13.5: кросс-доменная связь domains/service ↔
// domains/shop на уровне Nest DI в этом модуле была полностью устранена — ни
// один провайдер/контроллер не импортировал и не инжектировал ничего из
// domains/shop. Не путай с close-accounting-period.direction-independence.spec.ts
// — это регрессионный тест, который намеренно и легитимно импортирует классы
// shop напрямую (без прохода через DI ShopAccountingModule), чтобы проверить
// независимость закрытия периода по direction; на providers/controllers/
// imports этого модуля он не влияет.
//
// PRD 3 (Фаза 12, docs/payroll-closing-and-accrual/
// prd-salary-payout-and-erp-cash-documents.md) вносит ОДНО новое, узкое и
// осознанное исключение из этого итога — MoyskladModule/
// MoyskladCashDocumentAdapter (providers, SHOP_ERP_CASH_DOCUMENT_PORT) ниже.
// Причина: CreateBalanceTransactionHandler/DeleteBalanceTransactionHandler —
// ОДИН хендлер на оба домена (тот же приём, что уже был у самого баланса,
// см. BALANCE_TRANSACTION_REPOSITORY выше и Reopen/RecalculateAccountingPeriodHandler)
// — при erpSyncRequired: true им нужен ErpCashDocumentPort ОБОИХ направлений
// одновременно (выбор адаптера зависит от command.direction, известного
// только на вызове, а не от того, из какого модуля пришёл запрос). Это НЕ
// импорт ShopAccountingModule (сам класс модуля бизнес-логики магазина
// здесь по-прежнему не появляется и не появится) — только МойСклад-адаптер
// кассовых документов и его HTTP-транспорт (MoyskladHttpService из
// MoyskladModule), заведённые собственным экземпляром под тем же токеном
// (SHOP_ERP_CASH_DOCUMENT_PORT), что и в ShopAccountingModule — ровно тот
// же приём «свой экземпляр под тем же токеном», которым ShopAccountingModule
// пользуется для классов domains/service (ACCOUNTING_PERIOD_REPOSITORY,
// ERP_CASH_DOCUMENT_REPOSITORY и т.д.), только в обратную сторону: там,
// где паттерн раньше был односторонним (shop переиспользует классы
// service), теперь он симметричен ровно в этом одном месте. Проверено
// перед выбором этого варианта: ShopAccountingModule НЕ импортирует
// AccountingModule ни прямо, ни через цепочку своих imports (ShopSalesModule/
// MoySkladSyncModule/DirectoryModule/MoyskladModule — ни один из них не
// ссылается на domains/service/modules/accounting), поэтому и обратный путь
// (AccountingModule импортирует MoyskladModule) не создаёт цикл. См. отчёт
// агента Фазы 12 — там же вариант «импортировать ShopAccountingModule
// целиком» и почему он не выбран (усложнение экспортов ради двух токенов,
// когда более узкий и уже привычный проекту приём решает ту же задачу).
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
        // RoappHttpService — вход RoappCashDocumentAdapter (SERVICE_ERP_CASH_DOCUMENT_PORT,
        // PRD 3 docs/payroll-closing-and-accrual, Фаза 11): ни RoappSyncModule,
        // ни RoappGatewayModule не экспортируют его наружу (обёртывают только
        // RoappService/RoappGateway), поэтому RoappModule импортирован здесь
        // напрямую.
        RoappModule,
        // MoyskladHttpService — вход MoyskladCashDocumentAdapter
        // (SHOP_ERP_CASH_DOCUMENT_PORT, PRD 3, Фаза 12) — см. WHY-блок в
        // шапке файла. Тот же приём, что RoappModule выше, и тот же, что
        // MoyskladModule в shop-accounting.module.ts (тот файл импортирует
        // его напрямую по той же причине — MoySkladSyncModule не
        // экспортирует MoyskladHttpService наружу).
        MoyskladModule,
        // Блокировка по сотруднику на время операции с erpSyncRequired (PRD
        // 3, «Технические ограничения») — общий экземпляр EmployeeOperationLock
        // на процесс, тот же приём, что DirectionSyncLockModule у
        // RoappSyncModule/MoySkladSyncModule.
        EmployeeOperationLockModule,
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
        // Массовое проведение (PRD 2, Фаза 7) и ОБЩИЙ баланс сотрудника
        // (Фаза 8b): маршруты баланса живут под /v1/accounting/balance без
        // направления в пути (см. routesV1.accounting.balance) — контроллеры
        // зарегистрированы здесь один раз на оба домена, реализация
        // direction-агностична; ошибочное ручное движение удаляется DELETE.
        AccrueSalaryAccrualDocumentHttpController,
        AccruePeriodSalaryAccrualsHttpController,
        CreateBalanceTransactionHttpController,
        DeleteBalanceTransactionHttpController,
        GetDepartmentBalancesHttpController,
        GetEmployeeBalanceHttpController,
        GetClosePeriodPreviewHttpController,
        // Конфигурация кассы ERP направления (PRD 3
        // docs/payroll-closing-and-accrual, Фаза 11) — GET/PUT под своим
        // путём /v1/service/accounting/erp_cash_config; PUT — generic по
        // direction команда, зеркальные контроллеры shop диспатчат её же
        // (см. ShopAccountingModule).
        GetErpCashConfigHttpController,
        // Выплата направления service (PRD 3
        // docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
        // Фаза 12) — под своим путём /v1/service/accounting/payout*, в
        // отличие от общего баланса (Фаза 8b) НЕ direction-агностична: у
        // выплаты своя касса ERP (SERVICE_ERP_CASH_DOCUMENT_PORT), поэтому
        // это отдельные хендлеры/контроллеры, а не диспатч общей команды
        // (тот же приём, что CloseAccountingPeriodHandler — 'service'
        // литералом внутри, а не поле команды).
        CreatePayoutHttpController,
        CreatePayoutBatchHttpController,
        GetPayoutPageHttpController,
        DeletePayoutHttpController,
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
        // AccrueSalaryAccrualLineCommand — своя транзакция на строку) и
        // ручные движения; Фаза 8b — удаление ошибочного ручного движения
        // (DELETE) на общем балансе сотрудника.
        AccrueSalaryAccrualDocumentHandler,
        AccruePeriodSalaryAccrualsHandler,
        CreateBalanceTransactionHandler,
        DeleteBalanceTransactionHandler,
        // Выплата направления service (PRD 3, Фаза 12) — см. WHY у
        // контроллеров выше.
        CreatePayoutHandler,
        CreatePayoutBatchHandler,
        DeletePayoutHandler,
        GetPayoutPageService,
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
        // Конфигурация кассы ERP и локальная связка «движение → документ
        // ERP» (PRD 3 docs/payroll-closing-and-accrual, Фаза 11) —
        // direction-агностичные реализации, тот же приём, что
        // BALANCE_TRANSACTION_REPOSITORY выше: ShopAccountingModule заводит
        // собственные экземпляры под теми же токенами. ErpCashConfigProvider
        // читает файловый конфиг модуля (env-переменные), не БД — PUT убран
        // (правка пользователя от 2026-08-24, см. заметку в конце Фазы 11
        // плана).
        GetErpCashConfigService,
        {
            provide: ERP_CASH_CONFIG_REPOSITORY,
            useClass: ErpCashConfigProvider,
        },
        {
            provide: ERP_CASH_DOCUMENT_REPOSITORY,
            useClass: ErpCashDocumentRepository,
        },
        // Адаптер записи в кассу RemOnline (PRD 3, Фаза 11) — НЕ
        // direction-агностичен, в отличие от ERP_CASH_CONFIG_REPOSITORY/
        // ERP_CASH_DOCUMENT_REPOSITORY выше: у shop свой токен
        // (SHOP_ERP_CASH_DOCUMENT_PORT) и своя реализация под МойСклад (см.
        // domains/shop/modules/accounting/application/ports/erp-cash-document.port.ts) —
        // порты уже объявлены разными файлами/типами специально для этого.
        {
            provide: SERVICE_ERP_CASH_DOCUMENT_PORT,
            useClass: RoappCashDocumentAdapter,
        },
        // Адаптер записи в кассу МойСклада (PRD 3, Фаза 12) — см. WHY-блок в
        // шапке файла: CreateBalanceTransactionHandler/
        // DeleteBalanceTransactionHandler (общий хендлер на оба домена,
        // ниже) нуждаются в обоих ErpCashDocumentPort сразу. Собственный
        // экземпляр под тем же токеном (SHOP_ERP_CASH_DOCUMENT_PORT), что и
        // в ShopAccountingModule, тот же приём, что уже применён там для
        // классов domains/service. EmployeeIdentityRepository —
        // единственная дополнительная зависимость MoyskladCashDocumentAdapter
        // (резолв Bitrix ID сотрудника в MoySkladEmployee.id), которой ещё не
        // было в этом модуле — заведена собственным экземпляром под тем же
        // токеном (EMPLOYEE_IDENTITY_REPOSITORY), что и в
        // ShopAccountingModule/RoappCashDocumentAdapter (тот читает identity
        // напрямую через DatabaseService, см. WHY там, поэтому до этой фазы
        // токен здесь не требовался).
        {
            provide: EMPLOYEE_IDENTITY_REPOSITORY,
            useClass: EmployeeIdentityRepository,
        },
        {
            provide: SHOP_ERP_CASH_DOCUMENT_PORT,
            useClass: MoyskladCashDocumentAdapter,
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
