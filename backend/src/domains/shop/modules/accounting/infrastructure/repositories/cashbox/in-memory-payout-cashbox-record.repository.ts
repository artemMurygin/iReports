import { Cashbox } from '@/domains/shop/modules/accounting/domain/entities/cashbox/payout-cashbox-record.entity';
import type { PayoutCashboxRecordRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/cashbox/payout-cashbox-record-repository.port';
import { PayoutCashboxRecordAlreadyExistsException } from '@/domains/shop/modules/accounting/domain/exceptions/cashbox.exception';

// In-memory реализация PayoutCashboxRecordRepositoryPort для юнит-тестов
// выплаты/ручных движений направления shop (Фаза 4
// docs/service-shop-boundary-violations-fix) — до этой фазы тесты shop
// переиспользовали InMemoryErpCashDocumentRepository domains/service
// напрямую (§2.1 docs/service-shop-boundary-violations.md, "In-memory
// тестовые репозитории Service ... переиспользуется в тестах Shop"). Тот же
// приём, что InMemoryBalanceTransactionRepository: эмулирует уникальный
// индекс transactionId той же ошибкой, что и Prisma-реализация на P2002.
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
