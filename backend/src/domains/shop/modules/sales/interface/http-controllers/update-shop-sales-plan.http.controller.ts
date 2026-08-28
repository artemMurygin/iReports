import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ShopSalesPlanUpdateDto } from '../dto/shop-sales-plan-update.dto';
import { UpdateShopSalesPlanCommand } from '../../application/command/update-shop-sales-plan.command';

// Диспатчит UpdateShopSalesPlanCommand — собственная команда/хендлер
// направления shop (Фаза 7 docs/service-shop-boundary-violations-fix).
// Строка чужого направления никогда не резолвится (репозиторий фильтрует по
// direction: 'shop' на уровне Prisma-запроса, см. UpdateShopSalesPlanHandler).
@ApiTags('Продажи')
@Controller()
export class UpdateShopSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.shop.salesPlan.byId)
    @ApiOperation({
        summary: 'Изменить оборот и/или маржу строки плана направления shop',
    })
    async update(
        @Param('id') id: string,
        @Body() body: ShopSalesPlanUpdateDto,
    ): Promise<SalesPlanResponse> {
        const command = new UpdateShopSalesPlanCommand({
            planId: id,
            ...body,
        });
        return this.commandBus.execute(command);
    }
}
