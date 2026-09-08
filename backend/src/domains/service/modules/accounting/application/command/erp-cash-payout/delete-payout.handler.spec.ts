import { withRequestContext } from '@/shared/testing/with-request-context';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import type {
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
} from '@/domains/service/modules/accounting/application/ports/erp-cash/erp-cash-document.port';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { Cashbox } from '@/domains/service/modules/accounting/domain/entities/erp-cash/payout-cashbox-record.entity';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import {
    BalanceTransactionNotFoundException,
    BalanceTransactionNotPayoutException,
} from '@/modules/employee-balance/domain/exceptions/balance-transaction.exception';
import { PayoutCashboxRecordMissingForTransactionException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { InMemoryPayoutCashboxRecordRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/erp-cash/in-memory-payout-cashbox-record.repository';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { DeletePayoutHandler } from './delete-payout.handler';
import { DeletePayoutCommand } from './delete-payout.command';

// Удаление выплаты (PRD 3, Фаза 12): сначала ERP, затем в одной транзакции —
// движение с баланса и возврат PAID-документов сотрудника направления
// service в ACCRUED; отказ ERP — ничего не меняется.
describe('DeletePayoutHandler', () => {
    const buildAccrual = () =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 1000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
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
        const payoutCashboxRecordRepo =
            new InMemoryPayoutCashboxRecordRepository();
        const fakeErpPort: ErpCashDocumentPort = overrides?.erpPort ?? {
            create: () => Promise.reject(new Error('not used')),
            delete: (_p: DeleteErpCashDocumentParams) => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const unitOfWork: UnitOfWorkPort = overrides?.unitOfWork ?? {
            run: (work) => work(),
        };
        const handler = new DeletePayoutHandler(
            transactionRepo,
            accrualRepo,
            fakeErpPort,
            payoutCashboxRecordRepo,
            unitOfWork,
            new EmployeeOperationLock(),
        );
        return {
            handler,
            transactionRepo,
            accrualRepo,
            payoutCashboxRecordRepo,
        };
    };

    const seedPayout = async (
        transactionRepo: InMemoryBalanceTransactionRepository,
        payoutCashboxRecordRepo: InMemoryPayoutCashboxRecordRepository,
    ) => {
        const payout = withRequestContext(() =>
            BalanceTransaction.forPayout({
                employeeId: 42,
                direction: 'service',
                amount: 1000,
                createdBy: 7,
            }),
        );
        await transactionRepo.insertMany([payout]);
        const document = withRequestContext(() =>
            Cashbox.createPayout({
                transactionId: payout.id,
                system: 'ROAPP',
                kind: 'OUTCOME',
                amount: 1000,
                externalId: 'erp-ext-1',
            }),
        );
        await payoutCashboxRecordRepo.insert(document);
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
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
            erpPort,
        });
        const { payout } = await seedPayout(
            transactionRepo,
            payoutCashboxRecordRepo,
        );

        await withRequestContext(() =>
            handler.execute(new DeletePayoutCommand({ payoutId: payout.id })),
        );

        expect(deleteCalls).toEqual([
            { externalId: 'erp-ext-1', kind: 'OUTCOME', amount: 1000 },
        ]);
        expect(transactionRepo.store.size).toBe(0);
        expect(payoutCashboxRecordRepo.store.size).toBe(0);
    });

    it('возвращает PAID-документы сотрудника направления service в ACCRUED', async () => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const accrual = buildAccrual();
        withRequestContext(() => accrual.accrueLine(accrual.lines[0].id));
        accrual.markPaid();
        accrualRepo.store.set(accrual.id, accrual);

        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
            accrualRepo,
        });
        const { payout } = await seedPayout(
            transactionRepo,
            payoutCashboxRecordRepo,
        );

        await withRequestContext(() =>
            handler.execute(new DeletePayoutCommand({ payoutId: payout.id })),
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
                    new DeletePayoutCommand({ payoutId: 'missing' }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotFoundException);
    });

    it('движение не типа PAYOUT (ручное) — 409, через этот эндпоинт не удаляется', async () => {
        const { handler, transactionRepo } = build();
        const manual = withRequestContext(() =>
            BalanceTransaction.createManual({
                employeeId: 42,
                direction: 'service',
                type: 'ADVANCE',
                amount: 1000,
                createdBy: 7,
            }),
        );
        await transactionRepo.insertMany([manual]);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeletePayoutCommand({ payoutId: manual.id }),
                ),
            ),
        ).rejects.toThrow(BalanceTransactionNotPayoutException);
        expect(transactionRepo.store.size).toBe(1);
    });

    it('выплата другого направления (shop) — 409 через эндпоинт service', async () => {
        const { handler, transactionRepo } = build();
        const shopPayout = withRequestContext(() =>
            BalanceTransaction.forPayout({
                employeeId: 42,
                direction: 'shop',
                amount: 1000,
                createdBy: 7,
            }),
        );
        await transactionRepo.insertMany([shopPayout]);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeletePayoutCommand({ payoutId: shopPayout.id }),
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
                direction: 'service',
                amount: 1000,
                createdBy: 7,
            }),
        );
        await transactionRepo.insertMany([payout]);

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeletePayoutCommand({ payoutId: payout.id }),
                ),
            ),
        ).rejects.toThrow(PayoutCashboxRecordMissingForTransactionException);
        expect(deleteCalls).toHaveLength(0);
        expect(transactionRepo.store.size).toBe(1);
    });

    it('отказ ERP — ничего не меняется', async () => {
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('not used')),
            delete: () => Promise.reject(new Error('RemOnline недоступен')),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
            erpPort,
        });
        const { payout } = await seedPayout(
            transactionRepo,
            payoutCashboxRecordRepo,
        );

        await expect(
            withRequestContext(() =>
                handler.execute(
                    new DeletePayoutCommand({ payoutId: payout.id }),
                ),
            ),
        ).rejects.toThrow('RemOnline недоступен');

        expect(transactionRepo.store.size).toBe(1);
        expect(payoutCashboxRecordRepo.store.size).toBe(1);
    });
});
