import { Body, Controller, Put } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanTemplatePutDto } from '../dto/sales-plan-template-put.dto';
import { PutSalesPlanTemplateCommand } from '../../application/command/put-sales-plan-template.command';

@Controller(routesV1.version)
export class PutSalesPlanTemplateHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Put(routesV1.salesPlanTemplate.root)
    async put(
        @Body() body: SalesPlanTemplatePutDto,
    ): Promise<SalesPlanTemplateResponse> {
        const command = new PutSalesPlanTemplateCommand(body);
        return this.commandBus.execute(command);
    }
}
