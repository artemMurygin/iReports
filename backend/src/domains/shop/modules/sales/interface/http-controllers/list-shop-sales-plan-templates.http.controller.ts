import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListSalesPlanTemplatesService } from '@/domains/service/modules/sales/application/services/list-sales-plan-templates.service';

// direction: 'shop' подставляется здесь — listSalesPlanTemplatesQuerySchema
// больше не несёт direction (пустой объект), query у этого эндпоинта нет.
@ApiTags('Продажи')
@Controller()
export class ListShopSalesPlanTemplatesHttpController {
    constructor(
        private readonly listSalesPlanTemplates: ListSalesPlanTemplatesService,
    ) {}

    @Get(routesV1.shop.salesPlanTemplate.root)
    @ApiOperation({
        summary:
            'Получить дефолтный шаблон плана по отделам и категориям направления shop',
    })
    async list(): Promise<SalesPlanTemplateResponse[]> {
        return this.listSalesPlanTemplates.execute('shop');
    }
}
