import type { ErpCashConfigResponse } from 'ireports-contracts';
import type { ShopErpCashConfig } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-config.port';

// Зеркало domains/service/modules/accounting/infrastructure/mappers/
// erp-cash-config.mapper.ts — независимая копия для направления shop.
// Конфигурация кассы не персистится через Prisma (файловый конфиг модуля,
// см. ShopCashboxConfigRepository) — toDomain/toPersistence этому мапперу
// не нужны, только toResponse. Контракт ErpCashConfigResponse — один общий
// объект с полями обоих направлений (см. WHY у erpCashConfigSchema в
// contracts/commands/erp-cash.ts), поэтому roappCashboxId/roappCategoryId
// здесь всегда null: у ShopErpCashConfig таких полей вообще нет — они
// относятся только к направлению service. updatedAt всегда null —
// конфигурация не строка БД с меткой времени, а файловый конфиг модуля на
// основе env-переменных, читается только через GET.
export class ShopErpCashConfigMapper {
    toResponse(config: ShopErpCashConfig | null): ErpCashConfigResponse {
        if (!config) {
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
            moySkladExpenseItemId: config.moySkladExpenseItemId,
            moySkladIncomeItemId: config.moySkladIncomeItemId,
            organizationId: config.organizationId,
            updatedAt: null,
        };
    }
}
