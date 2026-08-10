import { Controller, Get, Query } from '@nestjs/common';
import type { SalesPlanResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanListQueryDto } from '../dto/sales-plan-list-query.dto';
import { ListSalesPlansService } from '../../application/services/list-sales-plans.service';

@Controller(routesV1.version)
export class ListSalesPlansHttpController {
    constructor(private readonly listSalesPlans: ListSalesPlansService) {}

    @Get(routesV1.salesPlan.root)
    async list(
        @Query() query: SalesPlanListQueryDto,
    ): Promise<SalesPlanResponse[]> {
        return this.listSalesPlans.execute(query.direction, query.period);
    }
}
