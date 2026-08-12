import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeleteSalesPlanCommand } from '../../application/command/delete-sales-plan.command';

@ApiTags('Продажи')
@Controller()
export class DeleteSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Эндпоинт обслуживает только direction: 'service' (путь под
    // /v1/service) — строка чужого направления трактуется как ненайденная
    // (см. DeleteSalesPlanHandler).
    @Delete(routesV1.service.salesPlan.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить строку плана продаж' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteSalesPlanCommand({
            planId: id,
            direction: 'service',
        });
        await this.commandBus.execute(command);
    }
}
