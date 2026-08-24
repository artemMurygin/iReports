import { Body, Controller, Put } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { PutErpCashConfigCommand } from '@/domains/service/modules/accounting/application/command/put-erp-cash-config.command';
import { ShopErpCashConfigPutDto } from '../dto/shop-erp-cash-config-put.dto';

// Правка конфигурации кассы МойСклада направления shop — тонкий HTTP-слой
// поверх generic по direction PutErpCashConfigCommand модуля accounting
// сервиса (хендлер зарегистрирован там же, CommandBus общий на всё
// приложение — тот же приём, что ReopenShopAccountingPeriodHttpController),
// с собственным путём под /v1/shop.
@ApiTags('Бухгалтерия: касса ERP магазина')
@Controller()
export class PutShopErpCashConfigHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Put(routesV1.shop.accounting.erpCashConfig)
    @ApiOperation({
        summary: 'Задать статью расходов и юрлицо МойСклада направления shop',
    })
    async put(
        @Body() body: ShopErpCashConfigPutDto,
    ): Promise<ErpCashConfigResponse> {
        const command = new PutErpCashConfigCommand({
            ...body,
            direction: 'shop',
        });
        return this.commandBus.execute(command);
    }
}
