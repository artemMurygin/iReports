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
import { DeleteSalesPlanCommand } from '@/domains/service/modules/sales/application/command/delete-sales-plan.command';

// direction: 'shop' подставляется здесь — план чужого направления
// трактуется хендлером как не найденный (см. DeleteSalesPlanHandler).
@ApiTags('Продажи')
@Controller()
export class DeleteShopSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.shop.salesPlan.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить строку плана продаж направления shop' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteSalesPlanCommand({
            planId: id,
            direction: 'shop',
        });
        await this.commandBus.execute(command);
    }
}
