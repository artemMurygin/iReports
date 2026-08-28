import { ShopErpCashDocument } from '@/domains/shop/modules/accounting/domain/entities/shop-erp-cash-document.entity';
import type { ShopErpCashDocumentRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-document-repository.port';
import { ShopErpCashDocumentAlreadyExistsException } from '@/domains/shop/modules/accounting/domain/exceptions/erp-cash-document.exception';

// In-memory реализация ShopErpCashDocumentRepositoryPort для юнит-тестов
// выплаты/ручных движений направления shop (Фаза 4
// docs/service-shop-boundary-violations-fix) — до этой фазы тесты shop
// переиспользовали InMemoryErpCashDocumentRepository domains/service
// напрямую (§2.1 docs/service-shop-boundary-violations.md, "In-memory
// тестовые репозитории Service ... переиспользуется в тестах Shop"). Тот же
// приём, что InMemoryBalanceTransactionRepository: эмулирует уникальный
// индекс transactionId той же ошибкой, что и Prisma-реализация на P2002.
export class InMemoryShopErpCashDocumentRepository implements ShopErpCashDocumentRepositoryPort {
    readonly store = new Map<string, ShopErpCashDocument>();

    insert(entity: ShopErpCashDocument): Promise<void> {
        for (const existing of this.store.values()) {
            if (existing.transactionId === entity.transactionId) {
                return Promise.reject(
                    new ShopErpCashDocumentAlreadyExistsException(
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

    findByTransactionId(
        transactionId: string,
    ): Promise<ShopErpCashDocument | null> {
        return Promise.resolve(
            [...this.store.values()].find(
                (document) => document.transactionId === transactionId,
            ) ?? null,
        );
    }

    findByTransactionIds(
        transactionIds: string[],
    ): Promise<ShopErpCashDocument[]> {
        const ids = new Set(transactionIds);
        return Promise.resolve(
            [...this.store.values()].filter((document) =>
                ids.has(document.transactionId),
            ),
        );
    }
}
