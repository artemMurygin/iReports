import { Controller, Get, Query } from '@nestjs/common';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanTemplateListQueryDto } from '../dto/sales-plan-template-list-query.dto';
import { ListSalesPlanTemplatesService } from '../../application/services/list-sales-plan-templates.service';

@Controller(routesV1.version)
export class ListSalesPlanTemplatesHttpController {
    constructor(
        private readonly listSalesPlanTemplates: ListSalesPlanTemplatesService,
    ) {}

    @Get(routesV1.salesPlanTemplate.root)
    async list(
        @Query() query: SalesPlanTemplateListQueryDto,
    ): Promise<SalesPlanTemplateResponse[]> {
        return this.listSalesPlanTemplates.execute(query.direction);
    }
}
