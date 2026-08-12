import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanUpdateDto } from '../dto/sales-plan-update.dto';
import { UpdateSalesPlanCommand } from '../../application/command/update-sales-plan.command';

@ApiTags('Продажи')
@Controller()
export class UpdateSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Эндпоинт обслуживает только direction: 'service' (путь под
    // /v1/service) — строка чужого направления трактуется как ненайденная
    // (см. UpdateSalesPlanHandler).
    @Patch(routesV1.service.salesPlan.byId)
    @ApiOperation({ summary: 'Изменить оборот и/или маржу строки плана' })
    async update(
        @Param('id') id: string,
        @Body() body: SalesPlanUpdateDto,
    ): Promise<SalesPlanResponse> {
        const command = new UpdateSalesPlanCommand({
            planId: id,
            direction: 'service',
            ...body,
        });
        return this.commandBus.execute(command);
    }
}
