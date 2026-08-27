import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { DEFAULT_BALANCE_TRANSACTIONS_PAGE_LIMIT } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type {
    BalanceTransactionDateTypeFilter,
    BalanceTransactionFilter,
    BalanceTransactionPage,
    BalanceTransactionRepositoryPort,
} from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SalaryAccrualLineAlreadyAccruedException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { compareBalanceTransactionsDesc } from '@/domains/service/modules/accounting/domain/services/balance-transaction-ordering';

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

    findLastMovementDateByEmployees(
        employeeIds: number[],
    ): Promise<Map<number, Date>> {
        const lastByEmployee = new Map<number, Date>();
        for (const transaction of this.store.values()) {
            if (!employeeIds.includes(transaction.employeeId)) {
                continue;
            }
            const current = lastByEmployee.get(transaction.employeeId);
            if (!current || transaction.occurredAt > current) {
                lastByEmployee.set(
                    transaction.employeeId,
                    transaction.occurredAt,
                );
            }
        }
        return Promise.resolve(lastByEmployee);
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

    // Общий предикат для findByEmployee/sumFilteredByEmployee (Фаза 7) —
    // тот же приём, что employeeLedgerWhere() в Prisma-репозитории: сумма
    // выборки обязана считаться по тому же фильтру, что и сама лента, а не
    // по укороченному дублю условий.
    private matchesLedgerFilter(
        transaction: BalanceTransaction,
        employeeId: number,
        filter: BalanceTransactionDateTypeFilter,
    ): boolean {
        return (
            transaction.employeeId === employeeId &&
            (!filter.from || transaction.occurredAt >= filter.from) &&
            (!filter.to || transaction.occurredAt <= filter.to) &&
            (!filter.types || filter.types.includes(transaction.type))
        );
    }

    findByEmployee(
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<BalanceTransactionPage> {
        const limit = filter.limit ?? DEFAULT_BALANCE_TRANSACTIONS_PAGE_LIMIT;
        const sorted = [...this.store.values()]
            .filter((transaction) =>
                this.matchesLedgerFilter(transaction, employeeId, filter),
            )
            // Тот же тройной ключ (occurredAt/createdAt/id), что и у
            // Prisma-репозитория — см. WHY в
            // domain/services/balance-transaction-ordering.ts. Раньше
            // in-memory сортировал только по occurredAt (без createdAt/id),
            // что расходилось с реальным репозиторием и маскировало
            // недетерминированность порядка ties в тестах.
            .sort(compareBalanceTransactionsDesc);
        const startIndex = filter.cursor
            ? sorted.findIndex(
                  (transaction) => transaction.id === filter.cursor,
              ) + 1
            : 0;
        const page = sorted.slice(startIndex, startIndex + limit);
        const hasMore = startIndex + limit < sorted.length;
        const nextCursor = hasMore ? page[page.length - 1].id : null;
        return Promise.resolve({ items: page, nextCursor, hasMore });
    }

    sumByEmployee(employeeId: number): Promise<number> {
        return Promise.resolve(
            [...this.store.values()]
                .filter((transaction) => transaction.employeeId === employeeId)
                .reduce((sum, transaction) => sum + transaction.amount, 0),
        );
    }

    sumFilteredByEmployee(
        employeeId: number,
        filter: BalanceTransactionDateTypeFilter,
    ): Promise<number> {
        return Promise.resolve(
            [...this.store.values()]
                .filter((transaction) =>
                    this.matchesLedgerFilter(transaction, employeeId, filter),
                )
                .reduce((sum, transaction) => sum + transaction.amount, 0),
        );
    }
}
