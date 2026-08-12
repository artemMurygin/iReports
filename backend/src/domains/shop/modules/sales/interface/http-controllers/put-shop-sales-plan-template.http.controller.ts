import { Body, Controller, Put } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanTemplatePutDto } from '@/domains/service/modules/sales/interface/dto/sales-plan-template-put.dto';
import { PutSalesPlanTemplateCommand } from '@/domains/service/modules/sales/application/command/put-sales-plan-template.command';

// direction: 'shop' подставляется здесь — putSalesPlanTemplateRequestSchema
// больше не несёт direction в теле.
@ApiTags('Продажи')
@Controller()
export class PutShopSalesPlanTemplateHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Put(routesV1.shop.salesPlanTemplate.root)
    @ApiOperation({
        summary:
            'Создать или обновить строку шаблона плана по отделу и категории направления shop',
    })
    async put(
        @Body() body: SalesPlanTemplatePutDto,
    ): Promise<SalesPlanTemplateResponse> {
        const command = new PutSalesPlanTemplateCommand({
            ...body,
            direction: 'shop',
        });
        return this.commandBus.execute(command);
    }
}
