import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPerformanceResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPerformanceListQueryDto } from '../dto/sales-performance-list-query.dto';
import { GetSalesPerformanceService } from '../../application/services/get-sales-performance.service';
import { toSalesPerformanceResponse } from '../../application/mappers/to-sales-performance-response';

@ApiTags('Продажи')
@Controller()
export class ListSalesPerformanceHttpController {
    constructor(
        private readonly getSalesPerformance: GetSalesPerformanceService,
    ) {}

    @Get(routesV1.service.salesPerformance.byPeriod)
    @ApiOperation({
        summary:
            'План, факт и прогноз продаж за период (поддержан только direction=service)',
    })
    async list(
        @Param('period') period: string,
        @Query() query: SalesPerformanceListQueryDto,
    ): Promise<SalesPerformanceResponse[]> {
        const performances = await this.getSalesPerformance.listForPeriod(
            query.direction,
            period,
        );
        return performances.map(toSalesPerformanceResponse);
    }
}
