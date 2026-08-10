import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { SalesPlanResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanUpdateDto } from '../dto/sales-plan-update.dto';
import { UpdateSalesPlanCommand } from '../../application/command/update-sales-plan.command';

@Controller(routesV1.version)
export class UpdateSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.salesPlan.byId)
    async update(
        @Param('id') id: string,
        @Body() body: SalesPlanUpdateDto,
    ): Promise<SalesPlanResponse> {
        const command = new UpdateSalesPlanCommand({ planId: id, ...body });
        return this.commandBus.execute(command);
    }
}
