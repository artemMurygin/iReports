import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListSalesPlanTemplatesService } from '../../application/services/list-sales-plan-templates.service';

@ApiTags('Продажи')
@Controller()
export class ListSalesPlanTemplatesHttpController {
    constructor(
        private readonly listSalesPlanTemplates: ListSalesPlanTemplatesService,
    ) {}

    // Эндпоинт обслуживает только direction: 'service' (путь под
    // /v1/service) — listSalesPlanTemplatesQuerySchema больше не несёт
    // direction (query у эндпоинта не осталось полей), поэтому
    // SalesPlanTemplateListQueryDto/@Query() здесь больше не нужны.
    @Get(routesV1.service.salesPlanTemplate.root)
    @ApiOperation({
        summary:
            'Получить дефолтный шаблон плана направления service по отделам и категориям',
    })
    async list(): Promise<SalesPlanTemplateResponse[]> {
        return this.listSalesPlanTemplates.execute('service');
    }
}
