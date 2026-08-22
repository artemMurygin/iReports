import {
    Prisma,
    BalanceTransaction as BalanceTransactionRecord,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';

// У движения ленты нет update (только insert и delete: отмена начисления
// удаляет движения строки, ошибочное ручное движение удаляется напрямую —
// Фаза 8b), поэтому toPersistence отдаёт плоский CreateManyInput;
// updatedAt у модели нет намеренно.
export class BalanceTransactionMapper {
    toDomain(record: BalanceTransactionRecord): BalanceTransaction {
        return new BalanceTransaction({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.createdAt,
            props: {
                employeeId: record.employeeId,
                direction: record.direction,
                type: record.type,
                amount: record.amount,
                occurredAt: record.occurredAt,
                createdBy: record.createdBy,
                comment: record.comment ?? undefined,
                period: record.period ?? undefined,
                accrualId: record.accrualId ?? undefined,
                lineId: record.lineId ?? undefined,
                ruleId: record.ruleId ?? undefined,
                erpSyncRequired: record.erpSyncRequired,
            },
        });
    }

    toPersistence(
        entity: BalanceTransaction,
    ): Prisma.BalanceTransactionCreateManyInput {
        return {
            id: entity.id,
            employeeId: entity.employeeId,
            direction: entity.direction,
            type: entity.type,
            amount: entity.amount,
            occurredAt: entity.occurredAt,
            createdBy: entity.createdBy,
            comment: entity.comment ?? null,
            period: entity.period ?? null,
            accrualId: entity.accrualId ?? null,
            lineId: entity.lineId ?? null,
            ruleId: entity.ruleId ?? null,
            erpSyncRequired: entity.erpSyncRequired,
            createdAt: entity.createdAt,
        };
    }
}
