import type { ErpCashConfigResponse } from 'ireports-contracts';
import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// entity === null — направление ещё ни разу не конфигурировали (GET до
// первого PUT), тот же приём, что toAccountingPeriodResponse: пустой ответ
// со всеми полями null вместо 404, чтобы экран настроек не отличал
// «ещё не заполнено» от ошибки.
export function toErpCashConfigResponse(
    entity: ErpCashConfig | null,
    direction: AccountingDirection,
): ErpCashConfigResponse {
    if (!entity) {
        return {
            direction,
            roappCashboxId: null,
            moySkladExpenseItemId: null,
            moySkladIncomeItemId: null,
            organizationId: null,
            updatedAt: null,
        };
    }
    return {
        direction: entity.direction,
        roappCashboxId: entity.roappCashboxId,
        moySkladExpenseItemId: entity.moySkladExpenseItemId,
        moySkladIncomeItemId: entity.moySkladIncomeItemId,
        organizationId: entity.organizationId,
        updatedAt: entity.updatedAt,
    };
}
