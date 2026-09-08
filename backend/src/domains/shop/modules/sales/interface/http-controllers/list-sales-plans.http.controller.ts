import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ShopSalesPlanListQueryDto } from '../dto/sales-plan-list-query.dto';
import { ListShopSalesPlansService } from '../../application/services/list-sales-plans.service';

// Собственный ListShopSalesPlansService направления shop (Фаза 7
// docs/service-shop-boundary-violations-fix) — не переиспользует
// ListSalesPlansService направления service.
@ApiTags('Продажи')
@Controller()
export class ListShopSalesPlansHttpController {
    constructor(private readonly listSalesPlans: ListShopSalesPlansService) {}

    @Get(routesV1.shop.salesPlan.root)
    @ApiOperation({ summary: 'Получить план месяца направления shop' })
    async list(
        @Query() query: ShopSalesPlanListQueryDto,
    ): Promise<SalesPlanResponse[]> {
        return this.listSalesPlans.execute(query.period);
    }
}
