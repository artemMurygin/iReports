import { Injectable } from '@nestjs/common';
import { ShopErpCashConfig } from '@/domains/shop/modules/accounting/domain/entities/shop-erp-cash-config.entity';
import { ShopErpCashConfigRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-config.port';
import { shopErpCashConfig } from '@/domains/shop/modules/accounting/config/erp-cash.config';

// Реализация ShopErpCashConfigRepositoryPort поверх файлового конфига
// модуля (env-переменные, config/erp-cash.config.ts), а не БД — тот же
// приём, что ErpCashConfigProvider направления service
// (domains/service/modules/accounting/infrastructure/config/erp-cash-config.provider.ts),
// но собственный, независимый класс (Фаза 4
// docs/service-shop-boundary-violations-fix): раньше MoyskladCashDocumentAdapter
// инжектил напрямую сервисную реализацию под токеном ERP_CASH_CONFIG_REPOSITORY
// — этот класс её заменяет под собственным токеном
// SHOP_ERP_CASH_CONFIG_REPOSITORY.
@Injectable()
export class ShopErpCashConfigProvider implements ShopErpCashConfigRepositoryPort {
    findConfig(): Promise<ShopErpCashConfig | null> {
        return Promise.resolve(
            ShopErpCashConfig.create({
                moySkladExpenseItemId: shopErpCashConfig.moySkladExpenseItemId,
                moySkladIncomeItemId: shopErpCashConfig.moySkladIncomeItemId,
                organizationId: shopErpCashConfig.organizationId,
            }),
        );
    }
}
