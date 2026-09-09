import { Module } from '@nestjs/common';
import { GetCatalogService } from './application/services/get-catalog.service';
import { GetCatalogHttpController } from './interface/http-controllers/get-catalog.http.controller';
import { MoySkladSyncModule } from '@/domains/shop/sync/moySklad/moysklad-sync.module';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { ShopAccountingPeriodRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/accounting-period/accounting-period.repository';
import { RebuildGoodsTurnoverReportService } from './application/services/goods-turnover-report/rebuild-goods-turnover-report.service';
import { GetGoodsTurnoverReportService } from './application/services/goods-turnover-report/get-goods-turnover-report.service';
import { GetShopStoresService } from './application/services/get-stores.service';
import { GoodsTurnoverReportCron } from './infrastructure/cron/goods-turnover-report.cron';
import { GoodsTurnoverPeriodClosedHandler } from './application/events/period-closed.handler';
import { GoodsTurnoverReportRepository } from './infrastructure/repositories/goods-turnover-report/goods-turnover-report.repository';
import { GOODS_TURNOVER_REPORT_REPOSITORY } from './application/ports/goods-turnover-report/goods-turnover-report.port';
import { GetGoodsTurnoverReportHttpController } from './interface/http-controllers/get-goods-turnover-report.http.controller';
import { GetShopStoresHttpController } from './interface/http-controllers/get-shop-stores.http.controller';

// Модуль warehouse (Фаза 1, см.
// docs/shop-warehouse-catalog/plan-shop-warehouse-catalog.md) — исходно
// одна сущность catalog: дерево категорий MoySkladProductFolder. Отчёт по
// оборачиваемости (shop-turnover-report, D1) расширяет этот же модуль —
// остатки/обороты по дереву каталога логически продолжают уже начатую
// ответственность warehouse, а не заводят отдельный домен (см. design.md).
// DatabaseService доступен глобально (DatabaseModule помечен @Global()),
// явный импорт не нужен.
//
// MoySkladSyncModule — источник ProductFolderTreeService (обход дерева
// категорий, см. RebuildGoodsTurnoverReportService) и, транзитивно,
// MoySkladSyncService/MoySkladStockSyncCron (снимки остатков — не отсюда,
// а из sync/moySklad, но модуль всё равно нужен ради ProductFolderTreeService).
//
// SHOP_ACCOUNTING_PERIOD_REPOSITORY (статус периода "открыт/закрыт" для
// GoodsTurnoverReportCron, design.md D7.2/D9) — сознательно НЕ через импорт
// целого ShopAccountingModule (несмотря на то, что design.md D7.2 добавил
// этот токен в его exports именно для межмодульного переиспользования, по
// образцу того, как сам AccountingModule импортирует ShopSalesModule ради
// SALES_PLAN_REPOSITORY): ShopAccountingModule транзитивно тянет ShopSalesModule/
// DirectoryModule/MoyskladModule/EmployeeOperationLockModule/EmployeeBalanceModule
// и требует UNIT_OF_WORK — непропорционально тяжёлый граф зависимостей ради
// одного read-only метода репозитория, который сам по себе зависит только
// от глобального DatabaseService (см. ShopAccountingPeriodRepository).
// Собственный экземпляр класса под тем же токеном — тот же приём, что уже
// применён в самом ShopAccountingModule для EMPLOYEE_IDENTITY_REPOSITORY/
// WORK_SCHEDULE_ENTRY_REPOSITORY (см. WHY-комментарии там): класс не
// содержит бизнес-логики, специфичной для другого модуля, поэтому его
// повторная регистрация здесь не создаёт расхождения в поведении. Импорт
// целого ShopAccountingModule здесь также сломал бы изолированный
// catalog.e2e.spec.ts (Nest не может разрешить UNIT_OF_WORK/прочие токены
// ShopSalesModule в TestingModule, где импортирован только ShopWarehouseModule).
@Module({
    imports: [MoySkladSyncModule],
    controllers: [
        GetCatalogHttpController,
        GetGoodsTurnoverReportHttpController,
        GetShopStoresHttpController,
    ],
    providers: [
        GetCatalogService,
        RebuildGoodsTurnoverReportService,
        GetGoodsTurnoverReportService,
        GetShopStoresService,
        GoodsTurnoverReportCron,
        GoodsTurnoverPeriodClosedHandler,
        {
            provide: GOODS_TURNOVER_REPORT_REPOSITORY,
            useClass: GoodsTurnoverReportRepository,
        },
        {
            provide: SHOP_ACCOUNTING_PERIOD_REPOSITORY,
            useClass: ShopAccountingPeriodRepository,
        },
    ],
})
export class ShopWarehouseModule {}
