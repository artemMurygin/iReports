import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetErpCashConfigService } from '@/domains/service/modules/accounting/application/services/get-erp-cash-config.service';

// Конфигурация кассы МойСклада направления shop — тонкий HTTP-слой поверх
// GetErpCashConfigService модуля accounting сервиса (класс уже generic по
// direction, свой сервисный экземпляр заводить незачем, см.
// domains/service/CLAUDE.md), с собственным путём под /v1/shop (см.
// routesV1.shop.accounting.erpCashConfig).
@ApiTags('Бухгалтерия: касса ERP магазина')
@Controller()
export class GetShopErpCashConfigHttpController {
    constructor(private readonly getErpCashConfig: GetErpCashConfigService) {}

    @Get(routesV1.shop.accounting.erpCashConfig)
    @ApiOperation({
        summary: 'Конфигурация кассы МойСклада направления shop',
    })
    async get(): Promise<ErpCashConfigResponse> {
        return this.getErpCashConfig.execute('shop');
    }
}
