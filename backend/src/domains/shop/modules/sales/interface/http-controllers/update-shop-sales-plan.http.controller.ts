import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanUpdateDto } from '@/domains/service/modules/sales/interface/dto/sales-plan-update.dto';
import { UpdateSalesPlanCommand } from '@/domains/service/modules/sales/application/command/update-sales-plan.command';

// direction: 'shop' подставляется здесь, а не читается из тела — план
// чужого направления (см. UpdateSalesPlanHandler) трактуется хендлером как
// не найденный, поэтому строку service через этот путь не поправить.
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
        @Body() body: SalesPlanUpdateDto,
    ): Promise<SalesPlanResponse> {
        const command = new UpdateSalesPlanCommand({
            planId: id,
            direction: 'shop',
            ...body,
        });
        return this.commandBus.execute(command);
    }
}
