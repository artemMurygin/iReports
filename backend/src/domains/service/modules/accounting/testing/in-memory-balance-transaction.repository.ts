import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import type {
    BalanceTransactionFilter,
    BalanceTransactionRepositoryPort,
} from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SalaryAccrualLineAlreadyAccruedException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';

// In-memory реализация BalanceTransactionRepositoryPort для юнит- и
// e2e-тестов проведения строк (тот же приём, что
// InMemorySalaryAccrualRepository). Баланс общий по сотруднику (Фаза 8b):
// все выборки — по employeeId, направление движения не участвует.
// Эмулирует уникальный индекс (lineId, type) — контракт идемпотентности
// проведения: повторная вставка бросает тот же конфликт, что
// Prisma-реализация на P2002, причём атомарно — частично вставленный батч
// откатывается, как откатилась бы транзакция БД.
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

    findById(id: string): Promise<BalanceTransaction | null> {
        return Promise.resolve(this.store.get(id) ?? null);
    }

    deleteById(id: string): Promise<void> {
        this.store.delete(id);
        return Promise.resolve();
    }

    sumByEmployees(employeeIds: number[]): Promise<Map<number, number>> {
        const sums = new Map<number, number>();
        for (const transaction of this.store.values()) {
            if (employeeIds.includes(transaction.employeeId)) {
                sums.set(
                    transaction.employeeId,
                    (sums.get(transaction.employeeId) ?? 0) +
                        transaction.amount,
                );
            }
        }
        return Promise.resolve(sums);
    }

    findForDepartmentSummary(
        employeeIds: number[],
        period: string,
        monthStart: Date,
        monthEnd: Date,
    ): Promise<BalanceTransaction[]> {
        return Promise.resolve(
            [...this.store.values()].filter(
                (transaction) =>
                    employeeIds.includes(transaction.employeeId) &&
                    ((transaction.occurredAt >= monthStart &&
                        transaction.occurredAt <= monthEnd) ||
                        transaction.period === period),
            ),
        );
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
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<BalanceTransaction[]> {
        return Promise.resolve(
            [...this.store.values()]
                .filter(
                    (transaction) =>
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

    sumByEmployee(employeeId: number): Promise<number> {
        return Promise.resolve(
            [...this.store.values()]
                .filter((transaction) => transaction.employeeId === employeeId)
                .reduce((sum, transaction) => sum + transaction.amount, 0),
        );
    }
}
