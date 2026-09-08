import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { DirectoryModule } from '@/modules/directory/directory.module';
import { EmployeeOperationLockModule } from '@/shared/infrastructure/sync-lock/employee-operation-lock.module';
// RoappModule/MoyskladModule — вход RoappCashDocumentAdapter/
// MoyskladCashDocumentAdapter (SERVICE_/SHOP_ERP_CASH_DOCUMENT_PORT ниже) —
// см. WHY-блок над @Module(). Ни один из этих модулей не экспортирует
// RoappHttpService/MoyskladHttpService, поэтому импортированы напрямую (тот
// же приём, что уже применялся в domains/service/modules/accounting/
// accounting.module.ts до переноса баланса сюда).
import { RoappModule } from '@/domains/service/integrations/roapp/roapp.module';
import { RoappCashDocumentAdapter } from '@/domains/service/integrations/roapp/roapp-cash-document.adapter';
import { MoyskladModule } from '@/domains/shop/integrations/moySklad/moysklad.module';
import { MoyskladCashDocumentAdapter } from '@/domains/shop/integrations/moySklad/moysklad-cash-document.adapter';
import { CreateBalanceTransactionHandler } from '@/modules/employee-balance/application/command/create-balance-transaction.handler';
import { DeleteBalanceTransactionHandler } from '@/modules/employee-balance/application/command/delete-balance-transaction.handler';
import { GetEmployeeBalanceService } from '@/modules/employee-balance/application/services/get-employee-balance.service';
import { GetDepartmentBalancesService } from '@/modules/employee-balance/application/services/get-department-balances.service';
import { GetBalanceSummaryService } from '@/modules/employee-balance/application/services/get-balance-summary.service';
import { CreateBalanceTransactionHttpController } from '@/modules/employee-balance/interface/http-controllers/create-balance-transaction.http.controller';
import { DeleteBalanceTransactionHttpController } from '@/modules/employee-balance/interface/http-controllers/delete-balance-transaction.http.controller';
import { GetEmployeeBalanceHttpController } from '@/modules/employee-balance/interface/http-controllers/get-employee-balance.http.controller';
import { GetDepartmentBalancesHttpController } from '@/modules/employee-balance/interface/http-controllers/get-department-balances.http.controller';
import { GetBalanceSummaryHttpController } from '@/modules/employee-balance/interface/http-controllers/get-balance-summary.http.controller';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { BalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/balance-transaction.repository';
// Порты/репозитории ниже — direction-агностичная инфраструктура учёта,
// физически определённая в domains/service (см. WHY на
// domains/service/CLAUDE.md/backend/CLAUDE.md, "Общие таблицы"), но не
// бизнес-логика ни одного из доменов — тот же приём "собственный экземпляр
// под тем же токеном", которым accounting.module.ts/accounting.module.ts
// уже пользуются друг у друга для ACCOUNTING_PERIOD_REPOSITORY и т.п.
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { SalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/salary-accrual.repository';
import { PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash/payout-cashbox-record-repository.port';
import { PayoutCashboxRecordRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/erp-cash/payout-cashbox-record.repository';
import { ERP_CASH_CONFIG_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash/erp-cash-config.port';
import { ErpCashConfigRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/erp-cash/erp-cash-config.repository';
// Дедуп-репозиторий/конфиг кассы направления shop (Фаза 4
// docs/service-shop-boundary-violations-fix) — нужны ТОЛЬКО собственному
// экземпляру MoyskladCashDocumentAdapter (SHOP_ERP_CASH_DOCUMENT_PORT ниже):
// с этой фазы MoyskladCashDocumentAdapter инжектит SHOP_ERP_CASH_CONFIG_REPOSITORY/
// SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY (собственные классы domains/shop), а не
// ERP_CASH_CONFIG_REPOSITORY/PAYOUT_CASHBOX_RECORD_REPOSITORY domains/service —
// см. WHY у самого адаптера. PAYOUT_CASHBOX_RECORD_REPOSITORY/
// ERP_CASH_CONFIG_REPOSITORY (service) остаются: их по-прежнему использует
// RoappCashDocumentAdapter (SERVICE_ERP_CASH_DOCUMENT_PORT) И собственная,
// общая на оба направления лента баланса этого модуля (CreateBalanceTransactionHandler/
// GetEmployeeBalanceService ниже читают/пишут Cashbox domains/service
// напрямую для движений ОБОИХ направлений сразу — это не бизнес-логика
// конкретного домена, вне скоупа Фазы 4, см. WHY выше по файлу).
import { SHOP_ERP_CASH_CONFIG_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-config.port';
import { ShopCashboxConfigRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/cashbox/cashbox-config.repository';
import { SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/cashbox/payout-cashbox-record-repository.port';
import { PayoutCashboxRecordRepository as ShopPayoutCashboxRecordRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/cashbox/payout-cashbox-record.repository';
import { SERVICE_ERP_CASH_DOCUMENT_PORT } from '@/domains/service/modules/accounting/application/ports/erp-cash/erp-cash-document.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-document.port';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '@/modules/employee-identity/application/ports/employee-identity.port';
import { EmployeeIdentityRepository } from '@/modules/employee-identity/infrastructure/repositories/employee-identity.repository';
import { EMPLOYEE_DISMISSAL } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import { EmployeeDismissalRepository } from '@/modules/employee-dismissal/infrastructure/repositories/employee-dismissal.repository';

// Баланс сотрудника (PRD 2/3 docs/payroll-closing-and-accrual) — сквозной
// модуль вне доменов (Фаза 3 docs/service-shop-boundary-violations-fix):
// остаток и лента движений (`BalanceTransaction`) физически ЕДИНЫ на
// сотрудника (`SUM(amount)` без фильтра по `direction`, см. комментарий в
// prisma/schema/balance-transaction.prisma), а HTTP-эндпоинты
// (`/v1/accounting/balance/*`) уже не несут направление в пути — это не
// бизнес-логика ни `service`, ни `shop` (см. backend/CLAUDE.md, "Общие
// таблицы между service и shop", исключение BalanceTransaction). Раньше жил
// внутри `domains/service/modules/accounting`, что и создавало двусторонний
// цикл `Service.accounting ↔ Shop.moysklad-cash-document.adapter` (§2.2
// граф-аудита) — вынос сюда разрывает его.
//
// CreateBalanceTransactionHandler/DeleteBalanceTransactionHandler (ручные
// движения баланса, `erpSyncRequired: true`) нуждаются в ОБОИХ доменных
// портах записи кассового документа ERP сразу — выбор адаптера зависит от
// `command.direction`, известного только на вызове, а не от того, из какого
// модуля пришёл HTTP-запрос (эндпоинт один на оба направления). Сами порты
// (`SERVICE_ERP_CASH_DOCUMENT_PORT`/`SHOP_ERP_CASH_DOCUMENT_PORT`) остаются
// определены в своих доменах (`domains/service`/`domains/shop`) — этот
// модуль их не трогает, только заводит собственные экземпляры реализаций
// (`RoappCashDocumentAdapter`/`MoyskladCashDocumentAdapter`) под теми же
// токенами, ровно тот же приём "свой экземпляр под тем же токеном", каким
// `accounting.module.ts`/`accounting.module.ts` уже пользуются для
// direction-агностичных классов друг друга (`ACCOUNTING_PERIOD_REPOSITORY`
// и т.п.) — а не импорт целиком бизнес-модулей `AccountingModule`/
// `ShopAccountingModule` (это создало бы цикл: `ShopAccountingModule` ниже
// сам импортирует `EmployeeBalanceModule` за `BALANCE_TRANSACTION_REPOSITORY`
// для своих хендлеров выплаты). `SALARY_ACCRUAL_REPOSITORY`/
// `PAYOUT_CASHBOX_RECORD_REPOSITORY`/`ERP_CASH_CONFIG_REPOSITORY`/
// `EMPLOYEE_IDENTITY_REPOSITORY`/`EMPLOYEE_DISMISSAL` — тот же приём: классы
// без бизнес-логики, специфичной для направления, уже дублируемые как
// "свой экземпляр под тем же токеном" в обоих доменных модулях учёта.
//
// AccountingModule (service) по-прежнему заводит СОБСТВЕННЫЙ экземпляр
// `BALANCE_TRANSACTION_REPOSITORY` (нужен его CreatePayoutHandler/
// AccrueSalaryAccrualLineHandler и т.п., которые в этот модуль не переехали
// — только сам общий баланс/ручные движения/сводки), поэтому его импортировать
// сюда не нужно — экспорт токена ниже нужен только `ShopAccountingModule`,
// который свой локальный провайдер `BALANCE_TRANSACTION_REPOSITORY` убрал
// (баланс больше не per-domain).
@Module({
    imports: [
        CqrsModule,
        DirectoryModule,
        EmployeeOperationLockModule,
        RoappModule,
        MoyskladModule,
    ],
    controllers: [
        CreateBalanceTransactionHttpController,
        DeleteBalanceTransactionHttpController,
        GetEmployeeBalanceHttpController,
        GetDepartmentBalancesHttpController,
        GetBalanceSummaryHttpController,
    ],
    providers: [
        CreateBalanceTransactionHandler,
        DeleteBalanceTransactionHandler,
        GetEmployeeBalanceService,
        GetDepartmentBalancesService,
        GetBalanceSummaryService,
        {
            provide: BALANCE_TRANSACTION_REPOSITORY,
            useClass: BalanceTransactionRepository,
        },
        {
            provide: SALARY_ACCRUAL_REPOSITORY,
            useClass: SalaryAccrualRepository,
        },
        {
            provide: PAYOUT_CASHBOX_RECORD_REPOSITORY,
            useClass: PayoutCashboxRecordRepository,
        },
        {
            provide: ERP_CASH_CONFIG_REPOSITORY,
            useClass: ErpCashConfigRepository,
        },
        // Дедуп-репозиторий/конфиг кассы направления shop — только для
        // MoyskladCashDocumentAdapter (SHOP_ERP_CASH_DOCUMENT_PORT ниже), см.
        // WHY у импортов выше.
        {
            provide: SHOP_ERP_CASH_CONFIG_REPOSITORY,
            useClass: ShopCashboxConfigRepository,
        },
        {
            provide: SHOP_PAYOUT_CASHBOX_RECORD_REPOSITORY,
            useClass: ShopPayoutCashboxRecordRepository,
        },
        {
            provide: EMPLOYEE_IDENTITY_REPOSITORY,
            useClass: EmployeeIdentityRepository,
        },
        {
            provide: EMPLOYEE_DISMISSAL,
            useClass: EmployeeDismissalRepository,
        },
        {
            provide: SERVICE_ERP_CASH_DOCUMENT_PORT,
            useClass: RoappCashDocumentAdapter,
        },
        {
            provide: SHOP_ERP_CASH_DOCUMENT_PORT,
            useClass: MoyskladCashDocumentAdapter,
        },
    ],
    // BALANCE_TRANSACTION_REPOSITORY — единственный экспорт, реально
    // потребляемый снаружи (ShopAccountingModule, см. WHY выше).
    exports: [BALANCE_TRANSACTION_REPOSITORY],
})
export class EmployeeBalanceModule {}
