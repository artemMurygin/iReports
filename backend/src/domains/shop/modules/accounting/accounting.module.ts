import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ShopSalesModule } from '@/domains/shop/modules/sales/sales.module';
import { MoySkladSyncModule } from '@/domains/shop/sync/moySklad/moysklad-sync.module';
import { MoyskladModule } from '@/domains/shop/integrations/moySklad/moysklad.module';
import { DomainSyncStatusModule } from '@/shared/infrastructure/domain-sync-status/domain-sync-status.module';
import { EmployeeOperationLockModule } from '@/shared/infrastructure/sync-lock/employee-operation-lock.module';
import { DirectoryModule } from '@/modules/directory/directory.module';
// Баланс сотрудника — сквозной модуль вне доменов (Фаза 3
// docs/service-shop-boundary-violations-fix, см. WHY в
// src/modules/employee-balance/employee-balance.module.ts): импортирован
// сюда только за экспортированным BALANCE_TRANSACTION_REPOSITORY (нужен
// CreateShopPayoutHandler/CreateShopPayoutBatchHandler/DeleteShopPayoutHandler
// ниже — своя, per-direction выплата shop читает/пишет общую ленту).
// EmployeeBalanceModule НЕ импортирует ShopAccountingModule обратно (свои
// SERVICE_/SHOP_ERP_CASH_DOCUMENT_PORT он заводит собственными экземплярами
// через RoappModule/MoyskladModule напрямую, не через бизнес-модули доменов)
// — цикла нет.
import { EmployeeBalanceModule } from '@/modules/employee-balance/employee-balance.module';
import { ListShopSalaryRuleTypesService } from '@/domains/shop/modules/accounting/application/services/motivation-schema/list-salary-rule-types.service';
import { ListShopTaskCompletionsService } from '@/domains/shop/modules/accounting/application/services/task-completion/list-task-completions.service';
import { ListShopMotivationSchemasService } from '@/domains/shop/modules/accounting/application/services/motivation-schema/list-motivation-schemas.service';
import { GetShopMotivationSchemaService } from '@/domains/shop/modules/accounting/application/services/motivation-schema/get-motivation-schema.service';
import { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/calculation/build-calculation-context.service';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import { GetShopEmployeeSalaryReportService } from '@/domains/shop/modules/accounting/application/services/salary-report/get-employee-salary-report.service';
import { GetShopDepartmentSalaryReportService } from '@/domains/shop/modules/accounting/application/services/salary-report/get-department-salary-report.service';
import { CreateShopSalaryRuleHandler } from '@/domains/shop/modules/accounting/application/command/motivation-schema/create-salary-rule.handler';
import { CreateShopPayoutHandler } from '@/domains/shop/modules/accounting/application/command/cashbox-payout/create-payout.handler';
import { CreateShopPayoutBatchHandler } from '@/domains/shop/modules/accounting/application/command/cashbox-payout/create-payout-batch.handler';
import { DeleteShopPayoutHandler } from '@/domains/shop/modules/accounting/application/command/cashbox-payout/delete-payout.handler';
import { CreateShopMotivationSchemaHandler } from '@/domains/shop/modules/accounting/application/command/motivation-schema/create-motivation-schema.handler';
import { UpdateShopMotivationSchemaHandler } from '@/domains/shop/modules/accounting/application/command/motivation-schema/update-motivation-schema.handler';
import { CreateShopTaskCompletionHandler } from '@/domains/shop/modules/accounting/application/command/task-completion/create-task-completion.handler';
import { ConfirmShopTaskCompletionHandler } from '@/domains/shop/modules/accounting/application/command/task-completion/confirm-task-completion.handler';
import { DeleteShopTaskCompletionHandler } from '@/domains/shop/modules/accounting/application/command/task-completion/delete-task-completion.handler';
import { CalculateShopSnapshotRowsService } from '@/domains/shop/modules/accounting/application/services/calculation/calculate-snapshot-rows.service';
import { MoySkladErpPeriodSyncAdapter } from '@/domains/shop/modules/accounting/infrastructure/sync/moysklad-erp-period-sync.adapter';
import { GetShopClosePeriodPreviewHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/accounting-period/get-close-period-preview.http.controller';
import { GetShopErpCashConfigHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/cashbox/get-cashbox-config.http.controller';
import { CreateShopPayoutHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/cashbox-payout/create-payout.http.controller';
import { CreateShopPayoutBatchHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/cashbox-payout/create-payout-batch.http.controller';
import { DeleteShopPayoutHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/cashbox-payout/delete-payout.http.controller';
import { CloseShopAccountingPeriodHandler } from '@/domains/shop/modules/accounting/application/command/accounting-period/close-accounting-period.handler';
import { ListShopSalaryRuleTypesHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/motivation-schema/list-salary-rule-types.http.controller';
import { CreateShopMotivationSchemaHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/motivation-schema/create-motivation-schema.http.controller';
import { ListShopMotivationSchemasHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/motivation-schema/list-motivation-schemas.http.controller';
import { GetShopMotivationSchemaHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/motivation-schema/get-motivation-schema.http.controller';
import { UpdateShopMotivationSchemaHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/motivation-schema/update-motivation-schema.http.controller';
import { CreateShopTaskCompletionHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/task-completion/create-task-completion.http.controller';
import { ConfirmShopTaskCompletionHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/task-completion/confirm-task-completion.http.controller';
import { DeleteShopTaskCompletionHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/task-completion/delete-task-completion.http.controller';
import { ListShopTaskCompletionsHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/task-completion/list-task-completions.http.controller';
import { GetShopAccountingPeriodHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/accounting-period/get-accounting-period.http.controller';
import { ReopenShopAccountingPeriodHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/accounting-period/reopen-accounting-period.http.controller';
import { RecalculateShopAccountingPeriodHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/accounting-period/recalculate-accounting-period.http.controller';
import { CloseShopAccountingPeriodHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/accounting-period/close-accounting-period.http.controller';
import { GetShopEmployeeSalaryReportHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-report/get-employee-salary-report.http.controller';
import { GetShopDepartmentSalaryReportHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-report/get-department-salary-report.http.controller';
import { ListShopSalaryAccrualsHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-accrual/list-salary-accruals.http.controller';
import { GetShopSalaryAccrualHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-accrual/get-salary-accrual.http.controller';
import { AccrueShopSalaryAccrualLineHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-accrual/accrue-salary-accrual-line.http.controller';
import { UnaccrueShopSalaryAccrualLineHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-accrual/unaccrue-salary-accrual-line.http.controller';
import { AdjustShopSalaryAccrualLineHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-accrual/adjust-salary-accrual-line.http.controller';
import { AccrueShopSalaryAccrualDocumentHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-accrual/accrue-salary-accrual-document.http.controller';
import { AccruePeriodShopSalaryAccrualsHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/salary-accrual/accrue-period-salary-accruals.http.controller';
import { AccrueShopSalaryAccrualLineHandler } from '@/domains/shop/modules/accounting/application/command/salary-accrual/accrue-salary-accrual-line.handler';
import { AdjustShopSalaryAccrualLineHandler } from '@/domains/shop/modules/accounting/application/command/salary-accrual/adjust-salary-accrual-line.handler';
import { UnaccrueShopSalaryAccrualLineHandler } from '@/domains/shop/modules/accounting/application/command/salary-accrual/unaccrue-salary-accrual-line.handler';
import { AccrueShopSalaryAccrualDocumentHandler } from '@/domains/shop/modules/accounting/application/command/salary-accrual/accrue-salary-accrual-document.handler';
import { AccruePeriodShopSalaryAccrualsHandler } from '@/domains/shop/modules/accounting/application/command/salary-accrual/accrue-period-salary-accruals.handler';
import { ReopenShopAccountingPeriodHandler } from '@/domains/shop/modules/accounting/application/command/accounting-period/reopen-accounting-period.handler';
import { RecalculateShopAccountingPeriodHandler } from '@/domains/shop/modules/accounting/application/command/accounting-period/recalculate-accounting-period.handler';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import { ShopMotivationSchemaRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/motivation-schema/motivation-schema.repository';
import { ShopSalaryRuleRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/motivation-schema/salary-rule.repository';
import { ShopTaskCompletionRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/task-completion/task-completion.repository';
import { ShopCalculationDataRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/calculation/calculation-data.repository';
import { GetShopAccountingPeriodService } from '@/domains/shop/modules/accounting/application/services/accounting-period/get-accounting-period.service';
import { GetShopErpCashConfigService } from '@/domains/shop/modules/accounting/application/services/cashbox/get-cashbox-config.service';
import { ListShopSalaryAccrualsService } from '@/domains/shop/modules/accounting/application/services/salary-accrual/list-salary-accruals.service';
import { GetShopSalaryAccrualService } from '@/domains/shop/modules/accounting/application/services/salary-accrual/get-salary-accrual.service';
import { GetShopClosePeriodPreviewService } from '@/domains/shop/modules/accounting/application/services/accounting-period/get-close-period-preview.service';
import { ErpPeriodSyncRunner } from '@/shared/application/services/erp-period-sync-runner.service';
import { ERP_PERIOD_SYNC } from '@/shared/application/ports/erp-period-sync.port';
import { SHOP_SNAPSHOT_ROWS_CALCULATOR } from '@/domains/shop/modules/accounting/application/ports/calculation/snapshot-rows-calculator.port';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import { WorkScheduleEntryRepository } from '@/modules/work-schedule/infrastructure/repositories/work-schedule-entry.repository';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { EMPLOYEE_DISMISSAL } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import { ShopSalaryAccrualRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/salary-accrual/salary-accrual.repository';
import { EmployeeDismissalRepository } from '@/modules/employee-dismissal/infrastructure/repositories/employee-dismissal.repository';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { SHOP_ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import { SHOP_ACCOUNTING_CALCULATION_CACHE } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import { SHOP_ERP_CASH_CONFIG_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-config.port';
import { SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/cashbox/payout-cashbox-record-repository.port';
import { ShopAccountingPeriodRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/accounting-period/accounting-period.repository';
import { ShopAccountingPeriodSnapshotRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/accounting-period/accounting-period-snapshot.repository';
import { ShopAccountingCalculationCacheRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/calculation/accounting-calculation-cache.repository';
import { ShopCashboxConfigRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/cashbox/cashbox-config.repository';
import { PayoutCashboxRecordRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/cashbox/payout-cashbox-record.repository';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '@/modules/employee-identity/application/ports/employee-identity.port';
import { EmployeeIdentityRepository } from '@/modules/employee-identity/infrastructure/repositories/employee-identity.repository';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-document.port';
import { MoyskladCashDocumentAdapter } from '@/domains/shop/integrations/moySklad/moysklad-cash-document.adapter';

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
// SHOP_SALES_PLAN_REPOSITORY — третий штамп свежести ленивого кэша
// (обновление плана продаж инвалидирует кэш); с Фазы 7
// (docs/service-shop-boundary-violations-fix) собственный, независимый от
// domains/service/modules/sales порт/репозиторий направления shop,
// экспортированный ShopSalesModule (уже импортирован этим модулем ради
// SHOP_SALES_PERFORMANCE_READER, см. выше) — этот модуль больше не заводит
// собственный локальный провайдер под ним, а инжектирует его напрямую из
// ShopSalesModule.
//
// Расчётный период направления shop (close/reopen/recalculate/get, см.
// routesV1.shop.accounting.period в app.routes.ts) — с Фаз 5–6
// docs/service-shop-boundary-violations-fix полностью независим от
// одноимённого куска domains/service/modules/accounting:
// CloseShopAccountingPeriodHandler/GetShopAccountingPeriodService/
// GetShopClosePeriodPreviewService/ReopenShopAccountingPeriodHandler/
// RecalculateShopAccountingPeriodHandler используют собственные классы/
// токены (SHOP_ACCOUNTING_PERIOD_REPOSITORY/SHOP_ACCOUNTING_PERIOD_SNAPSHOT/
// SHOP_ACCOUNTING_CALCULATION_CACHE/SHOP_SALARY_ACCRUAL_REPOSITORY, см.
// domains/shop/modules/accounting/domain/entities/accounting-period.entity.ts
// и salary-accrual.entity.ts) — таблицы в БД при этом остаются общими
// (partitioned по direction, миграция схемы не потребовалась). До Фазы 6
// Reopen/RecalculateAccountingPeriodHandler были CQRS CommandHandler'ами,
// зарегистрированными в AccountingModule сервиса и обслуживавшими оба
// направления через generic-по-direction токены сервиса — с Фазы 6 у shop
// собственные независимые хендлеры (зарегистрированы в providers ниже),
// ReopenShopAccountingPeriodHttpController/
// RecalculateShopAccountingPeriodHttpController диспатчат собственные
// команды через общий CommandBus (сам CommandBus общий на всё приложение,
// CqrsModule — тот же класс, что и в AccountingModule сервиса, но хендлеры —
// раздельные). Документы начисления (SalaryAccrual) — тоже с Фазы 6
// собственная независимая реализация domains/shop (см. providers ниже), не
// переиспользуют SALARY_ACCRUAL_REPOSITORY сервиса.
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
        // MoyskladHttpService для MoyskladCashDocumentAdapter (PRD 3, Фаза
        // 11) — MoySkladSyncModule экспортирует только MoySkladSyncService/
        // ProductFolderTreeService/DirectionSyncLockModule (см.
        // moysklad-sync.module.ts), не сам MoyskladModule и не
        // MoyskladHttpService, поэтому импортируем MoyskladModule напрямую,
        // тем же приёмом, что modules/marketing/pricing/pricing.module.ts.
        MoyskladModule,
        // Блокировка по сотруднику на время операции выплаты/удаления (PRD 3,
        // Фаза 12) — тот же ОДИН экземпляр EmployeeOperationLock на процесс,
        // что и в AccountingModule сервиса (EmployeeOperationLockModule не
        // @Global — импортируется явно каждым потребителем, но не
        // пересоздаёт инстанс: Nest-модуль синглтон на всё приложение, тот
        // же приём, что CqrsModule/CommandBus выше). Обязателен: без общего
        // экземпляра выплата shop и, например, ручное движение service того
        // же сотрудника не сериализовались бы друг с другом, хотя пишут в
        // один и тот же общий баланс (PRD 2).
        EmployeeOperationLockModule,
        // BALANCE_TRANSACTION_REPOSITORY — см. WHY у импорта выше.
        EmployeeBalanceModule,
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
        // Действия над строками документа (PRD 2, Фаза 6) — с Фазы 6
        // docs/service-shop-boundary-violations-fix контроллеры диспатчат
        // собственные, независимые Accrue/Unaccrue/AdjustShopSalaryAccrualLineCommand
        // через общий CommandBus (хендлеры зарегистрированы ниже, в этом же
        // модуле, а не в AccountingModule сервиса).
        AccrueShopSalaryAccrualLineHttpController,
        UnaccrueShopSalaryAccrualLineHttpController,
        AdjustShopSalaryAccrualLineHttpController,
        // Фаза 7 PRD 2: массовое проведение — тонкие контроллеры поверх
        // собственных, независимых команд (хендлеры зарегистрированы в этом
        // же модуле, см. Фазу 6). Баланс сотрудника с Фазы 8b — ОБЩИЙ
        // по employeeId: его эндпоинты (/v1/accounting/balance/*) и
        // контроллеры живут только в сквозном EmployeeBalanceModule (Фаза 3
        // docs/service-shop-boundary-violations-fix) — у shop собственных
        // контроллеров/экземпляров баланса нет.
        AccrueShopSalaryAccrualDocumentHttpController,
        AccruePeriodShopSalaryAccrualsHttpController,
        GetShopClosePeriodPreviewHttpController,
        // Конфигурация кассы ERP направления shop (PRD 3
        // docs/payroll-closing-and-accrual, Фаза 11) — зеркалит
        // service.accounting.erpCashConfig; read-only, PUT убран (правка
        // пользователя от 2026-08-24, см. заметку в конце Фазы 11 плана).
        GetShopErpCashConfigHttpController,
        // Выплата направления shop (PRD 3
        // docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
        // Фаза 12) — зеркалит service.accounting.payout (см.
        // domains/service/modules/accounting/accounting.module.ts), но
        // собственные команды/хендлеры (CreateShopPayoutCommand и т.д.):
        // ErpCashDocumentPort/адаптер МойСклада не переиспользуется между
        // доменами, поэтому это не тот случай, что Reopen/RecalculateAccountingPeriod
        // выше (общий хендлер на оба направления). DELETE .../balance/transactions/:id
        // (ручные движения) по-прежнему обслуживается только сквозным
        // EmployeeBalanceModule — см. routesV1.accounting.balance. GetShopPayoutPageHttpController
        // (страница-отчёт GET .../payout/:period) удалён
        // (docs/employee-settlements-page-redesign, Фаза 6) — заменена
        // сквозным GetBalanceSummaryHttpController направления service (Фаза 1
        // того же плана, без направления в пути); create-shop-payout-batch
        // остаётся зарегистрированным (см. WHY в create-payout-batch.handler.ts).
        CreateShopPayoutHttpController,
        CreateShopPayoutBatchHttpController,
        DeleteShopPayoutHttpController,
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
        GetShopAccountingPeriodService,
        // Фаза 2 PRD 1: калькулятор строк снапшота (общий для закрытия и
        // close-preview) и синк отгрузок МойСклада за месяц по требованию.
        // С Фазы 5 docs/service-shop-boundary-violations-fix — под
        // собственным, независимым от domains/service токеном
        // SHOP_SNAPSHOT_ROWS_CALCULATOR.
        CalculateShopSnapshotRowsService,
        ErpPeriodSyncRunner,
        GetShopClosePeriodPreviewService,
        {
            provide: SHOP_SNAPSHOT_ROWS_CALCULATOR,
            useExisting: CalculateShopSnapshotRowsService,
        },
        {
            provide: ERP_PERIOD_SYNC,
            useClass: MoySkladErpPeriodSyncAdapter,
        },
        // График работы (WorkScheduleEntry) — общий для направлений источник
        // PayPerHour; здесь только чтение для employeesWithoutHours.
        {
            provide: WORK_SCHEDULE_ENTRY_REPOSITORY,
            useClass: WorkScheduleEntryRepository,
        },
        // Документы начисления (PRD 1 docs/payroll-closing-and-accrual) — с
        // Фазы 6 docs/service-shop-boundary-violations-fix собственные
        // независимые сервисы чтения/CQRS-хендлеры и Prisma-репозиторий
        // domains/shop (не переиспользуют domains/service); общая таблица
        // salary_accruals (partitioned по direction) не разбивается — см.
        // WHY в salary-accrual.repository.ts.
        ListShopSalaryAccrualsService,
        GetShopSalaryAccrualService,
        AccrueShopSalaryAccrualLineHandler,
        AdjustShopSalaryAccrualLineHandler,
        UnaccrueShopSalaryAccrualLineHandler,
        AccrueShopSalaryAccrualDocumentHandler,
        AccruePeriodShopSalaryAccrualsHandler,
        // Reopen/Recalculate расчётного периода — с Фазы 6 собственные
        // независимые хендлеры domains/shop (до этой фазы диспатчились как
        // generic по direction команды сервиса через общий CommandBus, см.
        // WHY, ранее зафиксированный здесь и в domains/shop/CLAUDE.md).
        ReopenShopAccountingPeriodHandler,
        RecalculateShopAccountingPeriodHandler,
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
        // Расчётный период/снапшот/кэш расчёта — с Фазы 5
        // docs/service-shop-boundary-violations-fix собственные независимые
        // классы/токены domains/shop (не переиспользуют domains/service);
        // общая Prisma-таблица (partitioned по direction) при этом не
        // разбивается — см. WHY в ShopAccountingPeriodRepository.
        {
            provide: SHOP_ACCOUNTING_PERIOD_REPOSITORY,
            useClass: ShopAccountingPeriodRepository,
        },
        {
            provide: SHOP_ACCOUNTING_PERIOD_SNAPSHOT,
            useClass: ShopAccountingPeriodSnapshotRepository,
        },
        {
            provide: SHOP_ACCOUNTING_CALCULATION_CACHE,
            useClass: ShopAccountingCalculationCacheRepository,
        },
        // SHOP_SALES_PLAN_REPOSITORY больше не заводится здесь локальным
        // провайдером (Фаза 7 docs/service-shop-boundary-violations-fix) —
        // приходит через ShopSalesModule, который экспортирует его и уже
        // импортирован этим модулем (imports выше).
        {
            provide: SHOP_SALARY_ACCRUAL_REPOSITORY,
            useClass: ShopSalaryAccrualRepository,
        },
        // Конфигурация кассы ERP и локальная связка «движение → документ
        // ERP» направления shop (PRD 3 docs/payroll-closing-and-accrual,
        // Фаза 11) — собственные независимые классы/токены shop (Фаза 4
        // docs/service-shop-boundary-violations-fix): до этой фазы
        // переиспользовали ErpCashConfigProvider/ErpCashDocumentRepository
        // domains/service напрямую под токенами ERP_CASH_CONFIG_REPOSITORY/
        // ERP_CASH_DOCUMENT_REPOSITORY (§2.2
        // docs/service-shop-boundary-violations.md — обратное направление
        // цикла Shop.moysklad-cash-document.adapter → Service.accounting).
        // ShopCashboxConfigRepository читает файловый конфиг модуля
        // (env-переменные), не БД — PUT убран (правка пользователя от
        // 2026-08-24, см. заметку в конце Фазы 11 плана), поэтому здесь
        // больше нет ни PutShopErpCashConfigHttpController, ни
        // PutErpCashConfigHandler.
        GetShopErpCashConfigService,
        {
            provide: SHOP_ERP_CASH_CONFIG_REPOSITORY,
            useClass: ShopCashboxConfigRepository,
        },
        {
            provide: SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY,
            useClass: PayoutCashboxRecordRepository,
        },
        // EmployeeIdentity — сквозной справочник вне domains/service и
        // domains/shop (см. modules/employee-identity/employee-identity.module.ts),
        // но его модуль экспортирует только ResolveEmployeeByExternalIdService,
        // не сам репозиторий/токен — импортировать EmployeeIdentityModule
        // ради одного internal-провайдера избыточно. Собственный экземпляр
        // класса под тем же токеном — тот же приём, что и у
        // WORK_SCHEDULE_ENTRY_REPOSITORY выше: класс не содержит
        // бизнес-логики, специфичной для направления
        // (EmployeeIdentity вообще не различает service/shop на уровне
        // персистентности). Нужен MoyskladCashDocumentAdapter ниже, чтобы
        // резолвить Bitrix ID сотрудника в id сотрудника МойСклада.
        {
            provide: EMPLOYEE_IDENTITY_REPOSITORY,
            useClass: EmployeeIdentityRepository,
        },
        // Адаптер ErpCashDocumentPort направления shop (PRD 3, Фаза 11) —
        // см. WHY-комментарии в самом адаптере (agent Employee/Counterparty,
        // конвертация sum в копейки, отсутствие статьи доходов у CashIn).
        {
            provide: SHOP_ERP_CASH_DOCUMENT_PORT,
            useClass: MoyskladCashDocumentAdapter,
        },
        // Выплата направления shop (PRD 3, Фаза 12) — собственные
        // command-хендлеры (см. WHY у контроллеров выше). Им нужен
        // BALANCE_TRANSACTION_REPOSITORY — баланс больше не per-domain
        // (Фаза 3 docs/service-shop-boundary-violations-fix): токен приходит
        // из импортированного EmployeeBalanceModule (см. WHY выше), а не из
        // собственного провайдера этого модуля. Общий эндпоинт
        // DELETE .../balance/transactions/:id (ручные движения) по-прежнему
        // обслуживается только сквозным EmployeeBalanceModule.
        CreateShopPayoutHandler,
        CreateShopPayoutBatchHandler,
        DeleteShopPayoutHandler,
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
        // токен (см. sales.module.ts).
        ShopSalesModule,
    ],
})
export class ShopAccountingModule {}
