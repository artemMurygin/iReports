import type { BalanceTransaction as BalanceTransactionContract } from 'ireports-contracts';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { SalaryAccrualLine } from '@/domains/service/modules/accounting/domain/entities/salary-accrual-line.entity';
import { toSalaryAccrualLineResponse } from './to-salary-accrual-response';

// Движение ленты баланса → контракт. Хранимые ссылки движения —
// идентификаторы (accrualId/lineId/ruleId), поэтому раскрытие начисления до
// правила и источников (accrualLine) и признак «сторнировано» (isReversed —
// на движение ссылается MANUAL_REVERSAL) резолвятся на чтении и передаются
// сюда уже готовыми (см. GetEmployeeBalanceService).
export function toBalanceTransactionResponse(
    entity: BalanceTransaction,
    accrualLine: SalaryAccrualLine | null,
    isReversed: boolean,
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
        reversedTransactionId: entity.reversedTransactionId ?? null,
        erpSyncRequired: entity.erpSyncRequired,
        isReversed,
        accrualLine: accrualLine
            ? toSalaryAccrualLineResponse(accrualLine)
            : null,
    };
}
