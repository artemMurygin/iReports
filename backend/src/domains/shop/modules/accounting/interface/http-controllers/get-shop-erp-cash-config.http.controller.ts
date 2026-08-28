import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetShopErpCashConfigService } from '@/domains/shop/modules/accounting/application/services/get-shop-erp-cash-config.service';

// Конфигурация кассы МойСклада направления shop — тонкий HTTP-слой поверх
// GetShopErpCashConfigService, собственного сервиса модуля accounting
// магазина (Фаза 4 docs/service-shop-boundary-violations-fix — до этой
// фазы переиспользовал generic-по-direction GetErpCashConfigService
// domains/service напрямую), с собственным путём под /v1/shop (см.
// routesV1.shop.accounting.erpCashConfig).
@ApiTags('Бухгалтерия: касса ERP магазина')
@Controller()
export class GetShopErpCashConfigHttpController {
    constructor(
        private readonly getErpCashConfig: GetShopErpCashConfigService,
    ) {}

    @Get(routesV1.shop.accounting.erpCashConfig)
    @ApiOperation({
        summary: 'Конфигурация кассы МойСклада направления shop',
    })
    async get(): Promise<ErpCashConfigResponse> {
        return this.getErpCashConfig.execute();
    }
}
