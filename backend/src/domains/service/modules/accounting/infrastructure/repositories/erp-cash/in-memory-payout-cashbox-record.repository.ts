import { Cashbox } from '@/domains/service/modules/accounting/domain/entities/erp-cash/payout-cashbox-record.entity';
import type { PayoutCashboxRecordRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash/payout-cashbox-record-repository.port';
import { PayoutCashboxRecordAlreadyExistsException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';

// In-memory реализация PayoutCashboxRecordRepositoryPort для юнит- и e2e-тестов
// синхронизации ручного движения/выплаты с кассой ERP (PRD 3, Фаза 12) —
// тот же приём, что InMemoryBalanceTransactionRepository/
// InMemorySalaryAccrualRepository: эмулирует уникальный индекс
// transactionId (см. erp-cash.prisma) той же ошибкой, что и Prisma-
// реализация на P2002.
export class InMemoryPayoutCashboxRecordRepository implements PayoutCashboxRecordRepositoryPort {
    readonly store = new Map<string, Cashbox>();

    insert(entity: Cashbox): Promise<void> {
        for (const existing of this.store.values()) {
            if (existing.transactionId === entity.transactionId) {
                return Promise.reject(
                    new PayoutCashboxRecordAlreadyExistsException(
                        entity.transactionId,
                    ),
                );
            }
        }
        this.store.set(entity.id, entity);
        return Promise.resolve();
    }

    deleteById(id: string): Promise<void> {
        this.store.delete(id);
        return Promise.resolve();
    }

    findByTransactionId(transactionId: string): Promise<Cashbox | null> {
        return Promise.resolve(
            [...this.store.values()].find(
                (document) => document.transactionId === transactionId,
            ) ?? null,
        );
    }

    findByTransactionIds(transactionIds: string[]): Promise<Cashbox[]> {
        const ids = new Set(transactionIds);
        return Promise.resolve(
            [...this.store.values()].filter((document) =>
                ids.has(document.transactionId),
            ),
        );
    }
}
