import { Body, Controller, Put } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanTemplatePutDto } from '../dto/sales-plan-template-put.dto';
import { PutSalesPlanTemplateCommand } from '../../application/command/put-sales-plan-template.command';

@ApiTags('Продажи')
@Controller()
export class PutSalesPlanTemplateHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Эндпоинт обслуживает только direction: 'service' (путь под
    // /v1/service) — направление больше не читается из тела клиента.
    @Put(routesV1.service.salesPlanTemplate.root)
    @ApiOperation({
        summary:
            'Создать или обновить строку шаблона плана направления service по отделу и категории',
    })
    async put(
        @Body() body: SalesPlanTemplatePutDto,
    ): Promise<SalesPlanTemplateResponse> {
        const command = new PutSalesPlanTemplateCommand({
            ...body,
            direction: 'service',
        });
        return this.commandBus.execute(command);
    }
}
