import type {
    BalanceTransaction as BalanceTransactionContract,
    ExternalSystem,
} from 'ireports-contracts';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';

// Движение ленты баланса → контракт. Ссылки движения — идентификаторы
// (accrualId/lineId/ruleId): детализация начисления по правилам и
// источникам живёт в документе начисления, строка ленты не раскрывается —
// UI ведёт на документ по accrualId (Фаза 8b).
//
// erp — связка с ErpCashDocument (PRD 3, «Критерии готовности»: «Внешний ID
// документа ERP сохраняется и показывается в ленте баланса»); необязательный
// параметр (по умолчанию null — большинство вызовов, движение без ERP), но
// САМ вызывающий код обязан передать его явно там, где связка уже под рукой
// (см. GetEmployeeBalanceService, createWithErpSync) — а не оставлять поле
// пустым по забывчивости для erpSyncRequired: true движений.
export function toBalanceTransactionResponse(
    entity: BalanceTransaction,
    erp: { system: ExternalSystem; externalId: string } | null = null,
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
        erp,
    };
}
