import { withRequestContext } from '@/shared/testing/with-request-context';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';
import {
    BalanceTransactionNotDeletableException,
    BalanceTransactionNotFoundException,
} from '@/modules/employee-balance/domain/exceptions/balance-transaction.exception';
import { ErpCashDocumentMissingForTransactionException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import type {
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
} from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/testing/in-memory-balance-transaction.repository';
import { InMemoryErpCashDocumentRepository } from '@/domains/service/modules/accounting/testing/in-memory-erp-cash-document.repository';
import { DeleteBalanceTransactionHandler } from './delete-balance-transaction.handler';
import { DeleteBalanceTransactionCommand } from './delete-balance-transaction.command';

// Удаление ошибочного ручного движения (PRD 2, Фаза 8b; касса ERP — PRD 3,
// Фаза 12): запись исчезает из ленты, остаток пересчитывается; удалять
// можно только ручные движения — движение начисления и выплата (PAYOUT)
// прямому DELETE недоступны целиком (409). erpSyncRequired = false —
// простое удаление; erpSyncRequired = true — сначала документ в ERP, потом
// движение и связка в одной транзакции.
describe('DeleteBalanceTransactionHandler', () => {
    const build = (overrides?: {
        erpPort?: ErpCashDocumentPort;
        shopErpPort?: ErpCashDocumentPort;
        unitOfWork?: UnitOfWorkPort;
    }) => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const erpCashDocumentRepo = new InMemoryErpCashDocumentRepository();
        const fakeErpPort: ErpCashDocumentPort = overrides?.erpPort ?? {
            create: () => Promise.reject(new Error('не используется')),
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const shopErpPort: ErpCashDocumentPort =
            overrides?.shopErpPort ?? fakeErpPort;
        const unitOfWork: UnitOfWorkPort = overrides?.unitOfWork ?? {
            run: (work) => work(),
        };
        const handler = new DeleteBalanceTransactionHandler(
            transactionRepo,
            fakeErpPort,
            shopErpPort,
            erpCashDocumentRepo,
            unitOfWork,
            new EmployeeOperationLock(),
        );
        return {
            handler,
            transactionRepo,
            erpCashDocumentRepo,
            fakeErpPort,
            shopErpPort,
        };
    };

    const manual = (
        overrides: Partial<
            Parameters<typeof BalanceTransaction.createManual>[0]
        > = {},
    ) =>
        withRequestContext(() =>
            BalanceTransaction.createManual({
                employeeId: 42,
                direction: 'service',
                type: 'ADVANCE',
                amount: 4000,
                createdBy: 7,
                ...overrides,
            }),
        );

    it('удаляет ручное движение: запись исчезает из ленты, остаток пересчитан', async () => {
        const { handler, transactionRepo } = build();
        const advance = manual();
        const bonus = manual({ type: 'BONUS', amount: 1000 });
        await transactionRepo.insertMany([advance, bonus]);
        await expect(transactionRepo.sumByEmployee(42)).resolves.toBe(-3000);

        await withRequestContext(() =>
            handler.execute(
                new DeleteBalanceTransactionCommand({
                    transactionId: advance.id,
                }),
            ),
        );

        expect(transactionRepo.store.has(advance.id)).toBe(false);
        await expect(transactionRepo.sumByEmployee(42)).resolves.toBe(1000);
        // Повторный DELETE уже удалённого движения — 404: записи нет.
        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: advance.id,
                    }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotFoundException);
    });

    it('движение начисления прямым DELETE не удаляется — 409 (только «Отменить начисление» строки)', async () => {
        const { handler, transactionRepo } = build();
        const accrual = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 2000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        amount: 2000,
                        sources: [],
                    },
                ],
            }),
        );
        const transactions = withRequestContext(() =>
            BalanceTransaction.forAccruedLine(accrual, accrual.lines[0], 7),
        );
        await transactionRepo.insertMany(transactions);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: transactions[0].id,
                    }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotDeletableException);
        expect(transactionRepo.store.has(transactions[0].id)).toBe(true);
    });

    it('выплата (PAYOUT) прямым DELETE не удаляется — 409 (свой DELETE .../payout/:id)', async () => {
        const { handler, transactionRepo } = build();
        const payout = withRequestContext(() =>
            BalanceTransaction.forPayout({
                employeeId: 42,
                direction: 'service',
                amount: 5000,
                createdBy: 7,
            }),
        );
        await transactionRepo.insertMany([payout]);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: payout.id,
                    }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotDeletableException);
        expect(transactionRepo.store.has(payout.id)).toBe(true);
    });

    it('движение с документом ERP (erpSyncRequired): сначала удаление в ERP, потом движение и связка', async () => {
        const deleteCalls: DeleteErpCashDocumentParams[] = [];
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('не используется')),
            delete: (params) => {
                deleteCalls.push(params);
                return Promise.resolve();
            },
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, erpCashDocumentRepo } = build({
            erpPort,
        });
        const erpAdvance = manual({ erpSyncRequired: true });
        await transactionRepo.insertMany([erpAdvance]);
        await erpCashDocumentRepo.insert(
            ErpCashDocument.create({
                transactionId: erpAdvance.id,
                system: 'ROAPP',
                kind: 'OUTCOME',
                amount: 4000,
                externalId: 'erp-ext-1',
            }),
        );

        await withRequestContext(() =>
            handler.execute(
                new DeleteBalanceTransactionCommand({
                    transactionId: erpAdvance.id,
                }),
            ),
        );

        expect(deleteCalls).toEqual([
            { externalId: 'erp-ext-1', kind: 'OUTCOME', amount: 4000 },
        ]);
        expect(transactionRepo.store.has(erpAdvance.id)).toBe(false);
        await expect(
            erpCashDocumentRepo.findByTransactionId(erpAdvance.id),
        ).resolves.toBeNull();
    });

    it('отказ ERP при удалении — ничего не меняется, ошибка возвращается', async () => {
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('не используется')),
            delete: () => Promise.reject(new Error('RemOnline недоступен')),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, erpCashDocumentRepo } = build({
            erpPort,
        });
        const erpAdvance = manual({ erpSyncRequired: true });
        await transactionRepo.insertMany([erpAdvance]);
        await erpCashDocumentRepo.insert(
            ErpCashDocument.create({
                transactionId: erpAdvance.id,
                system: 'ROAPP',
                kind: 'OUTCOME',
                amount: 4000,
                externalId: 'erp-ext-2',
            }),
        );

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: erpAdvance.id,
                    }),
                ),
            ),
        ).rejects.toThrow('RemOnline недоступен');

        expect(transactionRepo.store.has(erpAdvance.id)).toBe(true);
        await expect(
            erpCashDocumentRepo.findByTransactionId(erpAdvance.id),
        ).resolves.not.toBeNull();
    });

    it('direction: shop с erpSyncRequired — вызывает SHOP-порт (не service)', async () => {
        const serviceCalls: DeleteErpCashDocumentParams[] = [];
        const shopCalls: DeleteErpCashDocumentParams[] = [];
        const serviceErpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('не используется')),
            delete: (params) => {
                serviceCalls.push(params);
                return Promise.resolve();
            },
            findByKey: () => Promise.resolve(null),
        };
        const shopErpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('не используется')),
            delete: (params) => {
                shopCalls.push(params);
                return Promise.resolve();
            },
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, erpCashDocumentRepo } = build({
            erpPort: serviceErpPort,
            shopErpPort,
        });
        const shopAdvance = manual({
            direction: 'shop',
            erpSyncRequired: true,
        });
        await transactionRepo.insertMany([shopAdvance]);
        await erpCashDocumentRepo.insert(
            ErpCashDocument.create({
                transactionId: shopAdvance.id,
                system: 'MOY_SKLAD',
                kind: 'OUTCOME',
                amount: 4000,
                externalId: 'ms-ext-1',
            }),
        );

        await withRequestContext(() =>
            handler.execute(
                new DeleteBalanceTransactionCommand({
                    transactionId: shopAdvance.id,
                }),
            ),
        );

        expect(serviceCalls).toHaveLength(0);
        expect(shopCalls).toEqual([
            { externalId: 'ms-ext-1', kind: 'OUTCOME', amount: 4000 },
        ]);
        expect(transactionRepo.store.has(shopAdvance.id)).toBe(false);
    });

    it('движение erpSyncRequired без связки ErpCashDocument (рассинхронизация) — отклонено', async () => {
        const { handler, transactionRepo } = build();
        const erpAdvance = manual({ erpSyncRequired: true });
        await transactionRepo.insertMany([erpAdvance]);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: erpAdvance.id,
                    }),
                ),
            ),
        ).rejects.toThrow(ErpCashDocumentMissingForTransactionException);
        expect(transactionRepo.store.has(erpAdvance.id)).toBe(true);
    });

    it('несуществующее движение — 404', async () => {
        const { handler } = build();
        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteBalanceTransactionCommand({
                        transactionId: 'missing',
                    }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotFoundException);
    });
});
