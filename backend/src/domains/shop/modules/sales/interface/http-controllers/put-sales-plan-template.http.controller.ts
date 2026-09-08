import { Body, Controller, Put } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ShopSalesPlanTemplatePutDto } from '../dto/sales-plan-template-put.dto';
import { PutShopSalesPlanTemplateCommand } from '../../application/command/put-sales-plan-template.command';

// Диспатчит PutShopSalesPlanTemplateCommand — собственная команда/хендлер
// направления shop (Фаза 7 docs/service-shop-boundary-violations-fix).
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
        @Body() body: ShopSalesPlanTemplatePutDto,
    ): Promise<SalesPlanTemplateResponse> {
        const command = new PutShopSalesPlanTemplateCommand({
            ...body,
        });
        return this.commandBus.execute(command);
    }
}
