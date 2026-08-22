import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import type {
    BalanceTransactionFilter,
    BalanceTransactionRepositoryPort,
} from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SalaryAccrualLineAlreadyAccruedException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';

// In-memory реализация BalanceTransactionRepositoryPort для юнит- и
// e2e-тестов проведения строк (тот же приём, что
// InMemorySalaryAccrualRepository). Эмулирует и уникальный индекс
// (lineId, type) — контракт идемпотентности проведения: повторная вставка
// движения той же строки бросает тот же конфликт, что Prisma-реализация
// на P2002, причём атомарно — частично вставленный батч откатывается, как
// откатилась бы транзакция БД.
export class InMemoryBalanceTransactionRepository implements BalanceTransactionRepositoryPort {
    readonly store = new Map<string, BalanceTransaction>();

    insertMany(transactions: BalanceTransaction[]): Promise<void> {
        const existingKeys = new Set(
            [...this.store.values()]
                .filter((transaction) => transaction.lineId)
                .map(
                    (transaction) =>
                        `${transaction.lineId}:${transaction.type}`,
                ),
        );
        for (const transaction of transactions) {
            if (
                transaction.lineId &&
                existingKeys.has(`${transaction.lineId}:${transaction.type}`)
            ) {
                return Promise.reject(
                    new SalaryAccrualLineAlreadyAccruedException(
                        transaction.lineId,
                    ),
                );
            }
        }
        for (const transaction of transactions) {
            this.store.set(transaction.id, transaction);
        }
        return Promise.resolve();
    }

    deleteAccrualTransactionsByLineId(lineId: string): Promise<void> {
        for (const [id, transaction] of this.store) {
            if (
                transaction.lineId === lineId &&
                (transaction.type === 'SALARY_ACCRUAL' ||
                    transaction.type === 'ACCRUAL_ADJUSTMENT')
            ) {
                this.store.delete(id);
            }
        }
        return Promise.resolve();
    }

    findByEmployee(
        direction: AccountingDirection,
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<BalanceTransaction[]> {
        return Promise.resolve(
            [...this.store.values()]
                .filter(
                    (transaction) =>
                        transaction.direction === direction &&
                        transaction.employeeId === employeeId &&
                        (!filter.from ||
                            transaction.occurredAt >= filter.from) &&
                        (!filter.to || transaction.occurredAt <= filter.to) &&
                        (!filter.types ||
                            filter.types.includes(transaction.type)),
                )
                .sort(
                    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
                ),
        );
    }

    sumByEmployee(
        direction: AccountingDirection,
        employeeId: number,
    ): Promise<number> {
        return Promise.resolve(
            [...this.store.values()]
                .filter(
                    (transaction) =>
                        transaction.direction === direction &&
                        transaction.employeeId === employeeId,
                )
                .reduce((sum, transaction) => sum + transaction.amount, 0),
        );
    }

    findReversedIds(transactionIds: string[]): Promise<Set<string>> {
        const ids = new Set(transactionIds);
        return Promise.resolve(
            new Set(
                [...this.store.values()]
                    .filter(
                        (transaction) =>
                            transaction.type === 'MANUAL_REVERSAL' &&
                            transaction.reversedTransactionId &&
                            ids.has(transaction.reversedTransactionId),
                    )
                    .map((transaction) => transaction.reversedTransactionId!),
            ),
        );
    }
}
