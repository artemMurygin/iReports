import { Injectable } from '@nestjs/common';
import type {
    ShopErpCashConfig,
    ShopErpCashConfigRepositoryPort,
} from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-config.port';
import { shopErpCashConfig } from '@/domains/shop/modules/accounting/infrastructure/repositories/cashbox/cashbox.config';

// Реализация ShopErpCashConfigRepositoryPort поверх файлового конфига
// модуля (env-переменные, erp-cash.config.ts рядом), а не БД — тот же
// приём, что ErpCashConfigProvider направления service
// (domains/service/modules/accounting/infrastructure/config/erp-cash-config.provider.ts),
// но собственный, независимый класс (Фаза 4
// docs/service-shop-boundary-violations-fix): раньше MoyskladCashDocumentAdapter
// инжектил напрямую сервисную реализацию под токеном ERP_CASH_CONFIG_REPOSITORY
// — этот класс её заменяет под собственным токеном
// SHOP_ERP_CASH_CONFIG_REPOSITORY. Переименован из ShopErpCashConfigProvider
// в ShopCashboxConfigRepository и перенесён из infrastructure/config в
// infrastructure/repositories — реализация *RepositoryPort, как и остальные
// файлы этой папки, а не отдельная роль "провайдер"; отдельная папка config/ с
// единственным файлом была лишней прослойкой, поэтому сам файловый конфиг
// (env-переменные) лежит прямо здесь, рядом с единственным потребителем.
@Injectable()
export class ShopCashboxConfigRepository implements ShopErpCashConfigRepositoryPort {
    findConfig(): Promise<ShopErpCashConfig | null> {
        return Promise.resolve({
            moySkladExpenseItemId: shopErpCashConfig.moySkladExpenseItemId,
            moySkladIncomeItemId: shopErpCashConfig.moySkladIncomeItemId,
            organizationId: shopErpCashConfig.organizationId,
        });
    }
}
