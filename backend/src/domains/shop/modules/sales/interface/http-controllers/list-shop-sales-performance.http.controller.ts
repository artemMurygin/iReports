import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPerformanceResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetShopSalesPerformanceService } from '../../application/services/get-shop-sales-performance.service';
import { toShopSalesPerformanceResponse } from '../../application/mappers/to-shop-sales-performance-response';

@ApiTags('Продажи')
@Controller()
export class ListShopSalesPerformanceHttpController {
    constructor(
        private readonly getShopSalesPerformance: GetShopSalesPerformanceService,
    ) {}

    @Get(routesV1.shop.salesPerformance.byPeriod)
    @ApiOperation({
        summary: 'План, факт и прогноз продаж направления shop за период',
    })
    async list(
        @Param('period') period: string,
    ): Promise<SalesPerformanceResponse[]> {
        const performances =
            await this.getShopSalesPerformance.listForPeriod(period);
        return performances.map(toShopSalesPerformanceResponse);
    }
}
