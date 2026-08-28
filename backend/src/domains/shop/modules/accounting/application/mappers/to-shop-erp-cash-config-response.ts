import type { ErpCashConfigResponse } from 'ireports-contracts';
import { ShopErpCashConfig } from '@/domains/shop/modules/accounting/domain/entities/shop-erp-cash-config.entity';

// Контракт ErpCashConfigResponse — один общий объект с полями обоих
// направлений (см. WHY у erpCashConfigSchema в contracts/commands/erp-cash.ts),
// поэтому roappCashboxId/roappCategoryId здесь всегда null: у ShopErpCashConfig
// (Фаза 4 docs/service-shop-boundary-violations-fix) таких полей вообще нет
// — они относятся только к направлению service. updatedAt всегда null —
// конфигурация не строка БД с меткой времени, а файловый конфиг модуля на
// основе env-переменных, читается только через GET.
export function toShopErpCashConfigResponse(
    entity: ShopErpCashConfig | null,
): ErpCashConfigResponse {
    if (!entity) {
        return {
            direction: 'shop',
            roappCashboxId: null,
            roappCategoryId: null,
            moySkladExpenseItemId: null,
            moySkladIncomeItemId: null,
            organizationId: null,
            updatedAt: null,
        };
    }
    return {
        direction: 'shop',
        roappCashboxId: null,
        roappCategoryId: null,
        moySkladExpenseItemId: entity.moySkladExpenseItemId,
        moySkladIncomeItemId: entity.moySkladIncomeItemId,
        organizationId: entity.organizationId,
        updatedAt: null,
    };
}
