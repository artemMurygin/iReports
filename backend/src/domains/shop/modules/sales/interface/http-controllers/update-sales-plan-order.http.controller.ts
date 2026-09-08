import { Body, Controller, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ShopSalesPlanOrderUpdateDto } from '../dto/sales-plan-order-update.dto';
import { UpdateShopSalesPlanOrderCommand } from '../../application/command/update-sales-plan-order.command';

// Диспатчит UpdateShopSalesPlanOrderCommand — собственная команда/хендлер
// направления shop (Фаза 4, docs/sales-plan-row-drag-and-drop-reorder),
// зеркало UpdateSalesPlanOrderHttpController направления service.
@ApiTags('Продажи')
@Controller()
export class UpdateShopSalesPlanOrderHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Литеральный сегмент "order" на том же PATCH-методе, что и byId (см.
    // UpdateShopSalesPlanHttpController), поэтому регистрация ЭТОГО
    // контроллера в sales.module.ts обязана идти раньше
    // UpdateShopSalesPlanHttpController — Express/Nest резолвят
    // совпадающие по методу маршруты в порядке регистрации, а не по
    // специфичности (тот же приём, что и у сервисного
    // UpdateSalesPlanOrderHttpController, см. комментарий там).
    @Patch(routesV1.shop.salesPlan.order)
    @ApiOperation({
        summary:
            'Задать глобальный порядок строк-категорий плана продаж отдела направления shop (drag-and-drop в модалке редактирования плана)',
    })
    async updateOrder(
        @Body() body: ShopSalesPlanOrderUpdateDto,
    ): Promise<SalesPlanTemplateResponse[]> {
        const command = new UpdateShopSalesPlanOrderCommand({
            department: body.department,
            items: body.items,
        });
        return this.commandBus.execute(command);
    }
}
