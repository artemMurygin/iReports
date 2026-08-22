import type { BalanceTransaction as BalanceTransactionContract } from 'ireports-contracts';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';

// Движение ленты баланса → контракт. Ссылки движения — идентификаторы
// (accrualId/lineId/ruleId): детализация начисления по правилам и
// источникам живёт в документе начисления, строка ленты не раскрывается —
// UI ведёт на документ по accrualId (Фаза 8b).
export function toBalanceTransactionResponse(
    entity: BalanceTransaction,
): BalanceTransactionContract {
    return {
        id: entity.id,
        employeeId: entity.employeeId,
        direction: entity.direction,
        type: entity.type,
        amount: entity.amount,
        occurredAt: entity.occurredAt,
        createdAt: entity.createdAt,
        createdBy: entity.createdBy,
        comment: entity.comment ?? null,
        period: entity.period ?? null,
        accrualId: entity.accrualId ?? null,
        lineId: entity.lineId ?? null,
        ruleId: entity.ruleId ?? null,
        erpSyncRequired: entity.erpSyncRequired,
    };
}
