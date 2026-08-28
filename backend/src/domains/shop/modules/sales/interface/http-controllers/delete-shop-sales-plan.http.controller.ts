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
import { DeleteShopSalesPlanCommand } from '../../application/command/delete-shop-sales-plan.command';

// Диспатчит DeleteShopSalesPlanCommand — собственная команда/хендлер
// направления shop (Фаза 7 docs/service-shop-boundary-violations-fix).
// Строка чужого направления никогда не резолвится (см.
// DeleteShopSalesPlanHandler).
@ApiTags('Продажи')
@Controller()
export class DeleteShopSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.shop.salesPlan.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить строку плана продаж направления shop' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteShopSalesPlanCommand({
            planId: id,
        });
        await this.commandBus.execute(command);
    }
}
