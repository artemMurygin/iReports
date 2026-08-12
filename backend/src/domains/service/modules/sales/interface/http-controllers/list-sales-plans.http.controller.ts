import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanListQueryDto } from '../dto/sales-plan-list-query.dto';
import { ListSalesPlansService } from '../../application/services/list-sales-plans.service';

@ApiTags('Продажи')
@Controller()
export class ListSalesPlansHttpController {
    constructor(private readonly listSalesPlans: ListSalesPlansService) {}

    // Эндпоинт обслуживает только direction: 'service' (путь под
    // /v1/service) — направление больше не читается из query клиента.
    @Get(routesV1.service.salesPlan.root)
    @ApiOperation({ summary: 'Получить план месяца направления service' })
    async list(
        @Query() query: SalesPlanListQueryDto,
    ): Promise<SalesPlanResponse[]> {
        return this.listSalesPlans.execute('service', query.period);
    }
}
