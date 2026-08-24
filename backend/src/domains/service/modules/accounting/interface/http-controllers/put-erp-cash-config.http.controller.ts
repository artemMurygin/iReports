import { Body, Controller, Put } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ErpCashConfigPutDto } from '../dto/erp-cash-config-put.dto';
import { PutErpCashConfigCommand } from '../../application/command/put-erp-cash-config.command';

@ApiTags('Бухгалтерия: касса ERP')
@Controller()
export class PutErpCashConfigHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Эндпоинт обслуживает только direction: 'service' (путь под
    // /v1/service) — направление подставляется контроллером, а не читается
    // из тела клиента (тот же приём, что PutSalesPlanTemplateHttpController).
    @Put(routesV1.service.accounting.erpCashConfig)
    @ApiOperation({
        summary: 'Задать ID кассы RemOnline направления service',
    })
    async put(
        @Body() body: ErpCashConfigPutDto,
    ): Promise<ErpCashConfigResponse> {
        const command = new PutErpCashConfigCommand({
            ...body,
            direction: 'service',
        });
        return this.commandBus.execute(command);
    }
}
