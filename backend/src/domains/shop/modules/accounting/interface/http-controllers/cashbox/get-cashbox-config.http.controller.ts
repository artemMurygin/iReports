import { Controller, Get, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { GetShopErpCashConfigService } from '@/domains/shop/modules/accounting/application/services/cashbox/get-cashbox-config.service';

// Конфигурация кассы МойСклада направления shop — тонкий HTTP-слой поверх
// GetShopErpCashConfigService, собственного сервиса модуля accounting
// магазина (Фаза 4 docs/service-shop-boundary-violations-fix — до этой
// фазы переиспользовал generic-по-direction GetErpCashConfigService
// domains/service напрямую), с собственным путём под /v1/shop (см.
// routesV1.shop.accounting.erpCashConfig).
@ApiTags('Бухгалтерия: касса ERP магазина')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('shop-accounting:view')
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
