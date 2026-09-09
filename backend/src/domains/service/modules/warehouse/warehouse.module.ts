import { Module } from '@nestjs/common';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { RoappGatewayModule } from '@/domains/service/integrations/roapp-gateway/roapp-gateway.module';
import { PRODUCT_CATEGORY_REPOSITORY } from './application/ports/product-category/product-category.port';
import { WAREHOUSE_REPOSITORY } from './application/ports/warehouse/warehouse.port';
import { GOODS_TURNOVER_REPORT_LINE_REPOSITORY } from './application/ports/goods-turnover-report/goods-turnover-report-line.port';
import { ProductCategoryRepository } from './infrastructure/repositories/product-category/product-category.repository';
import { WarehouseRepository } from './infrastructure/repositories/warehouse/warehouse.repository';
import { GoodsTurnoverReportLineRepository } from './infrastructure/repositories/goods-turnover-report/goods-turnover-report-line.repository';
import { BuildGoodsTurnoverReportService } from './application/services/build-goods-turnover-report.service';
import { GetGoodsTurnoverReportService } from './application/services/goods-turnover-report/get-goods-turnover-report.service';
import { ListProductCategoriesService } from './application/services/product-category/list-product-categories.service';
import { ListWarehousesService } from './application/services/warehouse/list-warehouses.service';
import { CloseGoodsTurnoverPeriod } from './application/events/close-goods-turnover-period.event-handler';
import { RecalculateOpenGoodsTurnoverPeriodCron } from './infrastructure/cron/recalculate-open-goods-turnover-period.cron';
import { GetGoodsTurnoverReportHttpController } from './interface/http-controllers/goods-turnover-report/get-goods-turnover-report.http.controller';
import { ListProductCategoriesHttpController } from './interface/http-controllers/product-category/list-product-categories.http.controller';
import { ListWarehousesHttpController } from './interface/http-controllers/warehouse/list-warehouses.http.controller';

// Сборка модуля `warehouse` (задача 13, architecture.md) — первая
// функциональность склада направления `service`: отчёт по оборачиваемости
// товара за месяц (design.md D1-D8). AccountingModule импортирован ради
// ACCOUNTING_PERIOD_REPOSITORY (см. exports там, задача 3) — почасовой крон
// (RecalculateOpenGoodsTurnoverPeriodCron, задача 11) читает статус
// зарплатного AccountingPeriod('service', period), у отчёта нет собственного
// статуса периода (design.md D5). RoappGatewayModule — вход ROAPP_GATEWAY
// для BuildGoodsTurnoverReportService (задача 9), тот же приём, что
// modules/marketing/pricing.
@Module({
    imports: [AccountingModule, RoappGatewayModule],
    controllers: [
        GetGoodsTurnoverReportHttpController,
        ListProductCategoriesHttpController,
        ListWarehousesHttpController,
    ],
    providers: [
        BuildGoodsTurnoverReportService,
        GetGoodsTurnoverReportService,
        ListProductCategoriesService,
        ListWarehousesService,
        // Обработчик закрытия периода (задача 12, design.md D7) и почасовой
        // крон пересчёта открытого периода (задача 11, design.md D6) —
        // обычные provider'ы, подписка/расписание регистрируются через
        // декораторы (@OnEvent/@ProdCron) на их собственных методах.
        CloseGoodsTurnoverPeriod,
        RecalculateOpenGoodsTurnoverPeriodCron,
        {
            provide: GOODS_TURNOVER_REPORT_LINE_REPOSITORY,
            useClass: GoodsTurnoverReportLineRepository,
        },
        {
            provide: PRODUCT_CATEGORY_REPOSITORY,
            useClass: ProductCategoryRepository,
        },
        {
            provide: WAREHOUSE_REPOSITORY,
            useClass: WarehouseRepository,
        },
    ],
})
export class WarehouseModule {}
