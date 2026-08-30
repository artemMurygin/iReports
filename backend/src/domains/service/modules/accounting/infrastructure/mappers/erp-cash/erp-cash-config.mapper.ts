import type { ErpCashConfigResponse } from 'ireports-contracts';
import type { ErpCashConfig } from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Конфигурация кассы не персистится через Prisma (файловый конфиг модуля,
// см. ErpCashConfigProvider) — toDomain/toPersistence этому мапперу не
// нужны, только toResponse.
export class ErpCashConfigMapper {
    // config === null — направление не поддерживается: с Фазы 4
    // docs/service-shop-boundary-violations-fix ErpCashConfigProvider
    // (service) обслуживает только direction = 'service' (см. WHY в
    // провайдере), для любого другого значения возвращает null — тот же
    // приём, что AccountingPeriodMapper.toResponse: пустой ответ со всеми
    // полями null вместо 404. updatedAt всегда null (правка пользователя от
    // 2026-08-24, см. заметку в конце Фазы 11 плана): конфигурация больше не
    // строка БД с меткой времени, а файловый конфиг модуля на основе
    // env-переменных, читается только через GET — поле оставлено в
    // контракте ради обратной совместимости формы ответа, но больше не
    // несёт смысла.
    toResponse(
        config: ErpCashConfig | null,
        direction: AccountingDirection,
    ): ErpCashConfigResponse {
        if (!config) {
            return {
                direction,
                roappCashboxId: null,
                roappCategoryId: null,
                moySkladExpenseItemId: null,
                moySkladIncomeItemId: null,
                organizationId: null,
                updatedAt: null,
            };
        }
        return {
            direction: config.direction,
            roappCashboxId: config.roappCashboxId,
            roappCategoryId: config.roappCategoryId,
            moySkladExpenseItemId: config.moySkladExpenseItemId,
            moySkladIncomeItemId: config.moySkladIncomeItemId,
            organizationId: config.organizationId,
            updatedAt: null,
        };
    }
}
