import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ShopGoodsTurnoverReportResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { Period } from '@/shared/domain/period.value-object';
import { GetGoodsTurnoverReportService } from '../../application/services/goods-turnover-report/get-goods-turnover-report.service';
import { GoodsTurnoverReportQueryDto } from '../dto/goods-turnover-report-query.dto';

// GET /v1/shop/warehouse/goods-turnover-report/:period (change
// shop-turnover-report, design.md D10) — оборот/остаток/коэффициент по
// категориям и складам за месяц. `:period` парсится в Period прямо в
// контроллере (Period.create бросает ArgumentInvalidException на
// невалидный формат → 400 через DomainExceptionFilter), т.к.
// GetGoodsTurnoverReportService.getReport принимает уже готовый VO
// (architecture.md Method Signatures), а не сырую строку.
@ApiTags('Магазин: склад')
@Controller()
export class GetGoodsTurnoverReportHttpController {
    constructor(
        private readonly getGoodsTurnoverReport: GetGoodsTurnoverReportService,
    ) {}

    @Get(routesV1.shop.warehouse.goodsTurnoverReport.byPeriod)
    @ApiOperation({
        summary:
            'Отчёт по оборачиваемости товаров магазина (оборот/остаток/коэффициент) за период',
    })
    async get(
        @Param('period') period: string,
        @Query() query: GoodsTurnoverReportQueryDto,
    ): Promise<ShopGoodsTurnoverReportResponse> {
        return this.getGoodsTurnoverReport.getReport(
            Period.create(period),
            query.warehouseId,
        );
    }
}
