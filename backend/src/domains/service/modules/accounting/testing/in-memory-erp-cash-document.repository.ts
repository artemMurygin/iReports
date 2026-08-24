import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';
import type { ErpCashDocumentRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import { ErpCashDocumentAlreadyExistsException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';

// In-memory реализация ErpCashDocumentRepositoryPort для юнит- и e2e-тестов
// синхронизации ручного движения/выплаты с кассой ERP (PRD 3, Фаза 12) —
// тот же приём, что InMemoryBalanceTransactionRepository/
// InMemorySalaryAccrualRepository: эмулирует уникальный индекс
// transactionId (см. erp-cash.prisma) той же ошибкой, что и Prisma-
// реализация на P2002.
export class InMemoryErpCashDocumentRepository implements ErpCashDocumentRepositoryPort {
    readonly store = new Map<string, ErpCashDocument>();

    insert(entity: ErpCashDocument): Promise<void> {
        for (const existing of this.store.values()) {
            if (existing.transactionId === entity.transactionId) {
                return Promise.reject(
                    new ErpCashDocumentAlreadyExistsException(
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
    ): Promise<ErpCashDocument | null> {
        return Promise.resolve(
            [...this.store.values()].find(
                (document) => document.transactionId === transactionId,
            ) ?? null,
        );
    }

    findByTransactionIds(transactionIds: string[]): Promise<ErpCashDocument[]> {
        const ids = new Set(transactionIds);
        return Promise.resolve(
            [...this.store.values()].filter((document) =>
                ids.has(document.transactionId),
            ),
        );
    }
}
