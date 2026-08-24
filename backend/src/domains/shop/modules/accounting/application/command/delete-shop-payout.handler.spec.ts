import { withRequestContext } from '@/shared/testing/with-request-context';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import type {
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
} from '@/domains/shop/modules/accounting/application/ports/erp-cash-document.port';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import {
    BalanceTransactionNotFoundException,
    BalanceTransactionNotPayoutException,
} from '@/domains/service/modules/accounting/domain/exceptions/balance-transaction.exception';
import { ErpCashDocumentMissingForTransactionException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { InMemoryErpCashDocumentRepository } from '@/domains/service/modules/accounting/testing/in-memory-erp-cash-document.repository';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { DeleteShopPayoutHandler } from './delete-shop-payout.handler';
import { DeleteShopPayoutCommand } from './delete-shop-payout.command';

// Удаление выплаты направления shop (PRD 3, Фаза 12) — зеркалит
// delete-payout.handler.spec.ts направления service: сначала ERP (МойСклад),
// затем в одной транзакции — движение с баланса и возврат PAID-документов
// сотрудника направления shop в ACCRUED; отказ ERP — ничего не меняется.
describe('DeleteShopPayoutHandler', () => {
    const buildAccrual = () =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'shop',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 1000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'ProductSold',
                        name: 'Продажа товара',
                        targetRole: 'ONLINE_MANAGER',
                        amount: 1000,
                        sources: [],
                    },
                ],
            }),
        );

    const build = (overrides?: {
        erpPort?: ErpCashDocumentPort;
        unitOfWork?: UnitOfWorkPort;
        accrualRepo?: InMemorySalaryAccrualRepository;
    }) => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const accrualRepo =
            overrides?.accrualRepo ?? new InMemorySalaryAccrualRepository();
        const erpCashDocumentRepo = new InMemoryErpCashDocumentRepository();
        const fakeErpPort: ErpCashDocumentPort = overrides?.erpPort ?? {
            create: () => Promise.reject(new Error('not used')),
            delete: (_p: DeleteErpCashDocumentParams) => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const unitOfWork: UnitOfWorkPort = overrides?.unitOfWork ?? {
            run: (work) => work(),
        };
        const handler = new DeleteShopPayoutHandler(
            transactionRepo,
            accrualRepo,
            fakeErpPort,
            erpCashDocumentRepo,
            unitOfWork,
            new EmployeeOperationLock(),
        );
        return { handler, transactionRepo, accrualRepo, erpCashDocumentRepo };
    };

    const seedPayout = async (
        transactionRepo: InMemoryBalanceTransactionRepository,
        erpCashDocumentRepo: InMemoryErpCashDocumentRepository,
    ) => {
        const payout = withRequestContext(() =>
            BalanceTransaction.forPayout({
                employeeId: 42,
                direction: 'shop',
                amount: 1000,
                createdBy: 7,
            }),
        );
        await transactionRepo.insertMany([payout]);
        const document = withRequestContext(() =>
            ErpCashDocument.create({
                transactionId: payout.id,
                system: 'MOY_SKLAD',
                kind: 'OUTCOME',
                amount: 1000,
                externalId: 'erp-ext-1',
            }),
        );
        await erpCashDocumentRepo.insert(document);
        return { payout, document };
    };

    it('удаляет выплату: сначала ERP, затем движение и связка ERP в одной транзакции', async () => {
        const deleteCalls: DeleteErpCashDocumentParams[] = [];
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('not used')),
            delete: (params) => {
                deleteCalls.push(params);
                return Promise.resolve();
            },
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, erpCashDocumentRepo } = build({
            erpPort,
        });
        const { payout } = await seedPayout(
            transactionRepo,
            erpCashDocumentRepo,
        );

        await withRequestContext(() =>
            handler.execute(
                new DeleteShopPayoutCommand({ payoutId: payout.id }),
            ),
        );

        expect(deleteCalls).toEqual([
            { externalId: 'erp-ext-1', kind: 'OUTCOME', amount: 1000 },
        ]);
        expect(transactionRepo.store.size).toBe(0);
        expect(erpCashDocumentRepo.store.size).toBe(0);
    });

    it('возвращает PAID-документы сотрудника направления shop в ACCRUED', async () => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const accrual = buildAccrual();
        withRequestContext(() => accrual.accrueLine(accrual.lines[0].id));
        accrual.markPaid();
        accrualRepo.store.set(accrual.id, accrual);

        const { handler, transactionRepo, erpCashDocumentRepo } = build({
            accrualRepo,
        });
        const { payout } = await seedPayout(
            transactionRepo,
            erpCashDocumentRepo,
        );

        await withRequestContext(() =>
            handler.execute(
                new DeleteShopPayoutCommand({ payoutId: payout.id }),
            ),
        );

        const saved = await accrualRepo.findById(accrual.id);
        expect(saved?.status).toBe('ACCRUED');
        expect(saved?.lines.every((line) => line.status === 'ACCRUED')).toBe(
            true,
        );
    });

    it('движение не найдено — 404', async () => {
        const { handler } = build();

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteShopPayoutCommand({ payoutId: 'missing' }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotFoundException);
    });

    it('движение не типа PAYOUT (ручное) — 409, через этот эндпоинт не удаляется', async () => {
        const { handler, transactionRepo } = build();
        const manual = withRequestContext(() =>
            BalanceTransaction.createManual({
                employeeId: 42,
                direction: 'shop',
                type: 'ADVANCE',
                amount: 1000,
                createdBy: 7,
            }),
        );
        await transactionRepo.insertMany([manual]);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteShopPayoutCommand({ payoutId: manual.id }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotPayoutException);
        expect(transactionRepo.store.size).toBe(1);
    });

    it('выплата другого направления (service) — 409 через эндпоинт shop', async () => {
        const { handler, transactionRepo } = build();
        const servicePayout = withRequestContext(() =>
            BalanceTransaction.forPayout({
                employeeId: 42,
                direction: 'service',
                amount: 1000,
                createdBy: 7,
            }),
        );
        await transactionRepo.insertMany([servicePayout]);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteShopPayoutCommand({ payoutId: servicePayout.id }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotPayoutException);
    });

    it('связка ERP не найдена (рассинхронизация) — 404, ERP не вызывается', async () => {
        const deleteCalls: DeleteErpCashDocumentParams[] = [];
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('not used')),
            delete: (params) => {
                deleteCalls.push(params);
                return Promise.resolve();
            },
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo } = build({ erpPort });
        const payout = withRequestContext(() =>
            BalanceTransaction.forPayout({
                employeeId: 42,
                direction: 'shop',
                amount: 1000,
                createdBy: 7,
            }),
        );
        await transactionRepo.insertMany([payout]);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteShopPayoutCommand({ payoutId: payout.id }),
                ),
            ),
        ).rejects.toThrow(ErpCashDocumentMissingForTransactionException);
        expect(deleteCalls).toHaveLength(0);
        expect(transactionRepo.store.size).toBe(1);
    });

    it('отказ ERP — ничего не меняется', async () => {
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('not used')),
            delete: () => Promise.reject(new Error('МойСклад недоступен')),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, erpCashDocumentRepo } = build({
            erpPort,
        });
        const { payout } = await seedPayout(
            transactionRepo,
            erpCashDocumentRepo,
        );

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeleteShopPayoutCommand({ payoutId: payout.id }),
                ),
            ),
        ).rejects.toThrow('МойСклад недоступен');

        expect(transactionRepo.store.size).toBe(1);
        expect(erpCashDocumentRepo.store.size).toBe(1);
    });
});
