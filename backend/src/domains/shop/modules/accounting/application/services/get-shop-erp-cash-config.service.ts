import { Inject, Injectable } from '@nestjs/common';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { SHOP_ERP_CASH_CONFIG_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-config.port';
import type { ShopErpCashConfigRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-config.port';
import { toShopErpCashConfigResponse } from '../mappers/to-shop-erp-cash-config-response';

// GET /v1/shop/accounting/erp_cash_config — до Фазы 4
// docs/service-shop-boundary-violations-fix обслуживался GetErpCashConfigService
// domains/service (generic-по-direction класс, см. WHY, который там был).
// Собственный, независимый сервис shop: GetShopErpCashConfigHttpController
// теперь не импортирует ничего из domains/service/modules/accounting.
@Injectable()
export class GetShopErpCashConfigService {
    constructor(
        @Inject(SHOP_ERP_CASH_CONFIG_REPOSITORY)
        private readonly repo: ShopErpCashConfigRepositoryPort,
    ) {}

    async execute(): Promise<ErpCashConfigResponse> {
        const entity = await this.repo.findConfig();
        return toShopErpCashConfigResponse(entity);
    }
}
