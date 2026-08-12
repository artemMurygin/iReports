import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanListQueryDto } from '@/domains/service/modules/sales/interface/dto/sales-plan-list-query.dto';
import { ListSalesPlansService } from '@/domains/service/modules/sales/application/services/list-sales-plans.service';

// direction: 'shop' подставляется здесь — ListSalesPlansService общий с
// направлением service (генерик поверх SalesPlan/SalesPlanTemplate, см.
// domains/shop/modules/sales/shop-sales.module.ts), направление больше не
// приходит в query.
@ApiTags('Продажи')
@Controller()
export class ListShopSalesPlansHttpController {
    constructor(private readonly listSalesPlans: ListSalesPlansService) {}

    @Get(routesV1.shop.salesPlan.root)
    @ApiOperation({ summary: 'Получить план месяца направления shop' })
    async list(
        @Query() query: SalesPlanListQueryDto,
    ): Promise<SalesPlanResponse[]> {
        return this.listSalesPlans.execute('shop', query.period);
    }
}
