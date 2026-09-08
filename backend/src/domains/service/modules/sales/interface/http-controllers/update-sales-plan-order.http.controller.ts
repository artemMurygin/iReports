import { Body, Controller, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanOrderUpdateDto } from '../dto/sales-plan-order-update.dto';
import { UpdateSalesPlanOrderCommand } from '../../application/command/update-sales-plan-order.command';

@ApiTags('Продажи')
@Controller()
export class UpdateSalesPlanOrderHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Литеральный сегмент "order" на том же PATCH-методе, что и byId
    // (":id" — см. UpdateSalesPlanHttpController), поэтому регистрация
    // ЭТОГО контроллера в sales.module.ts обязана идти раньше
    // UpdateSalesPlanHttpController — Express/Nest резолвят совпадающие по
    // методу маршруты в порядке регистрации, а не по специфичности
    // (см. комментарий в sales.module.ts у списка controllers).
    //
    // Эндпоинт обслуживает только direction: 'service' (путь под
    // /v1/service) — направление подставляется здесь, а не читается из
    // тела клиента.
    @Patch(routesV1.service.salesPlan.order)
    @ApiOperation({
        summary:
            'Задать глобальный порядок строк-категорий плана продаж отдела (drag-and-drop в модалке редактирования плана)',
    })
    async updateOrder(
        @Body() body: SalesPlanOrderUpdateDto,
    ): Promise<SalesPlanTemplateResponse[]> {
        const command = new UpdateSalesPlanOrderCommand({
            direction: 'service',
            department: body.department,
            items: body.items,
        });
        return this.commandBus.execute(command);
    }
}
