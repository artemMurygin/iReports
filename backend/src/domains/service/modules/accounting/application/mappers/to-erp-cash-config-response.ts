import type { ErpCashConfigResponse } from 'ireports-contracts';
import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// entity === null — направление не поддерживается: с Фазы 4
// docs/service-shop-boundary-violations-fix ErpCashConfigProvider (service)
// обслуживает только direction = 'service' (см. WHY в провайдере), для
// любого другого значения возвращает null — тот же приём, что
// toAccountingPeriodResponse: пустой ответ со всеми полями null вместо 404.
// updatedAt всегда null (правка пользователя от
// 2026-08-24, см. заметку в конце Фазы 11 плана): конфигурация больше не
// строка БД с меткой времени, а файловый конфиг модуля на основе
// env-переменных, читается только через GET — поле оставлено в контракте
// ради обратной совместимости формы ответа, но больше не несёт смысла.
export function toErpCashConfigResponse(
    entity: ErpCashConfig | null,
    direction: AccountingDirection,
): ErpCashConfigResponse {
    if (!entity) {
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
        direction: entity.direction,
        roappCashboxId: entity.roappCashboxId,
        roappCategoryId: entity.roappCategoryId,
        moySkladExpenseItemId: entity.moySkladExpenseItemId,
        moySkladIncomeItemId: entity.moySkladIncomeItemId,
        organizationId: entity.organizationId,
        updatedAt: null,
    };
}
