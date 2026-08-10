import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { routesV1 } from '@/config/app.routes';
import { DeleteSalesPlanCommand } from '../../application/command/delete-sales-plan.command';

@Controller(routesV1.version)
export class DeleteSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.salesPlan.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteSalesPlanCommand({ planId: id });
        await this.commandBus.execute(command);
    }
}
