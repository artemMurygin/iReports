import { Inject, Injectable } from '@nestjs/common';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { SHOP_ERP_CASH_CONFIG_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-config.port';
import type { ShopErpCashConfigRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-config.port';
import { ShopErpCashConfigMapper } from '@/domains/shop/modules/accounting/infrastructure/mappers/cashbox/cashbox-config.mapper';

// GET /v1/shop/accounting/erp_cash_config — до Фазы 4
// docs/service-shop-boundary-violations-fix обслуживался GetErpCashConfigService
// domains/service (generic-по-direction класс, см. WHY, который там был).
// Собственный, независимый сервис shop: GetShopErpCashConfigHttpController
// теперь не импортирует ничего из domains/service/modules/accounting.
@Injectable()
export class GetShopErpCashConfigService {
    private readonly mapper = new ShopErpCashConfigMapper();

    constructor(
        @Inject(SHOP_ERP_CASH_CONFIG_REPOSITORY)
        private readonly repo: ShopErpCashConfigRepositoryPort,
    ) {}

    async execute(): Promise<ErpCashConfigResponse> {
        const config = await this.repo.findConfig();
        return this.mapper.toResponse(config);
    }
}
