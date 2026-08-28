import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListShopSalesPlanTemplatesService } from '../../application/services/list-shop-sales-plan-templates.service';

// Собственный ListShopSalesPlanTemplatesService направления shop (Фаза 7
// docs/service-shop-boundary-violations-fix).
@ApiTags('Продажи')
@Controller()
export class ListShopSalesPlanTemplatesHttpController {
    constructor(
        private readonly listSalesPlanTemplates: ListShopSalesPlanTemplatesService,
    ) {}

    @Get(routesV1.shop.salesPlanTemplate.root)
    @ApiOperation({
        summary:
            'Получить дефолтный шаблон плана по отделам и категориям направления shop',
    })
    async list(): Promise<SalesPlanTemplateResponse[]> {
        return this.listSalesPlanTemplates.execute();
    }
}
