import type { ErpCashDocumentKind } from 'ireports-contracts';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type {
    CreateErpCashDocumentParams,
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
} from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { PayoutConfirmationRequiredException } from '@/domains/service/modules/accounting/domain/exceptions/salary-payout.exception';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { InMemoryErpCashDocumentRepository } from '@/domains/service/modules/accounting/testing/in-memory-erp-cash-document.repository';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { CreatePayoutHandler } from './create-payout.handler';
import { CreatePayoutCommand } from './create-payout.command';

// Выплата направления service (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 12): подтверждение при нулевом/отрицательном остатке или сумме
// больше остатка, синхронный порядок «ERP → БД» с компенсацией, переход
// ACCRUED → PAID при остатке после операции ≤ 0, блокировка по сотруднику.
describe('CreatePayoutHandler', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        findEmployees: () =>
            Promise.resolve([
                {
                    id: 42,
                    firstName: 'Иван',
                    lastName: 'Петров',
                    departmentId: 5,
                },
            ]),
    };

    const buildAccrual = (employeeId = 42) =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId,
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
        const erpCashDocumentRepo = new InMemoryErpCashDocumentRepository();
        const fakeErpPort: ErpCashDocumentPort = overrides?.erpPort ?? {
            create: (params: CreateErpCashDocumentParams) =>
                Promise.resolve({ externalId: `erp-${params.transactionId}` }),
            delete: (_params: DeleteErpCashDocumentParams) => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const unitOfWork: UnitOfWorkPort = overrides?.unitOfWork ?? {
            run: (work) => work(),
        };
        const employeeLock = new EmployeeOperationLock();
        const handler = new CreatePayoutHandler(
            transactionRepo,
            accrualRepo,
            fakeErpPort,
            erpCashDocumentRepo,
            fakeDirectoryRepo,
            unitOfWork,
            employeeLock,
        );
        return {
            handler,
            transactionRepo,
            accrualRepo,
            erpCashDocumentRepo,
            employeeLock,
        };
    };

    const command = (
        overrides: Partial<{
            employeeId: number;
            amount: number;
            confirmNegativeBalance: boolean;
        }> = {},
    ) =>
        new CreatePayoutCommand({
            employeeId: overrides.employeeId ?? 42,
            amount: overrides.amount ?? 1000,
            createdBy: 7,
            confirmNegativeBalance: overrides.confirmNegativeBalance,
        });

    it('остаток покрывает сумму — выплата создаётся без подтверждения, движение PAYOUT и документ ERP OUTCOME', async () => {
        const createCalls: CreateErpCashDocumentParams[] = [];
        const erpPort: ErpCashDocumentPort = {
            create: (params) => {
                createCalls.push(params);
                return Promise.resolve({ externalId: 'erp-1' });
            },
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, erpCashDocumentRepo } = build({
            erpPort,
        });
        await transactionRepo.insertMany([
            withRequestContext(() => importBonus(2000)),
        ]);

        const response = await withRequestContext(() =>
            handler.execute(command({ amount: 1000 })),
        );

        expect(response.transaction).toMatchObject({
            type: 'PAYOUT',
            amount: -1000,
            employeeId: 42,
            direction: 'service',
            erpSyncRequired: true,
        });
        expect(createCalls).toHaveLength(1);
        expect(createCalls[0]).toMatchObject({
            amount: 1000,
            kind: 'OUTCOME' satisfies ErpCashDocumentKind,
            employeeId: 42,
        });
        expect(createCalls[0].purpose).toContain('Выплата');
        expect(createCalls[0].purpose).toContain('Петров');

        const document = await erpCashDocumentRepo.findByTransactionId(
            response.transaction.id,
        );
        expect(document).toMatchObject({
            externalId: 'erp-1',
            kind: 'OUTCOME',
        });
        expect(response.erpDocument).toMatchObject({
            externalId: 'erp-1',
            kind: 'OUTCOME',
            amount: 1000,
        });
    });

    it('нулевой остаток без confirmNegativeBalance — 409 с текущим остатком и остатком после операции в metadata', async () => {
        const { handler, transactionRepo } = build();

        let error: PayoutConfirmationRequiredException | undefined;
        await withRequestContext(async () => {
            try {
                await handler.execute(command({ amount: 500 }));
            } catch (caught) {
                error = caught as PayoutConfirmationRequiredException;
            }
        });

        expect(error).toBeInstanceOf(PayoutConfirmationRequiredException);
        expect(error?.metadata).toEqual({
            employeeId: 42,
            balance: 0,
            balanceAfter: -500,
        });
        expect(transactionRepo.store.size).toBe(0);
    });

    it('сумма больше остатка без confirmNegativeBalance — 409', async () => {
        const { handler, transactionRepo } = build();
        await transactionRepo.insertMany([
            withRequestContext(() => importBonus(300)),
        ]);

        await expect(
            withRequestContext(() =>
                handler.execute(command({ amount: 1000 })),
            ),
        ).rejects.toThrow(PayoutConfirmationRequiredException);
        expect(transactionRepo.store.size).toBe(1);
    });

    it('confirmNegativeBalance: true разблокирует выплату при отрицательном остатке', async () => {
        const { handler, transactionRepo } = build();

        const response = await withRequestContext(() =>
            handler.execute(
                command({ amount: 1000, confirmNegativeBalance: true }),
            ),
        );

        expect(response.transaction.amount).toBe(-1000);
        expect(transactionRepo.store.size).toBe(1);
    });

    it('ошибка ERP — движение и документ ERP не создаются', async () => {
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.reject(new Error('RemOnline недоступен')),
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, erpCashDocumentRepo } = build({
            erpPort,
        });
        await transactionRepo.insertMany([
            withRequestContext(() => importBonus(2000)),
        ]);

        await expect(
            withRequestContext(() =>
                handler.execute(command({ amount: 1000 })),
            ),
        ).rejects.toThrow('RemOnline недоступен');

        expect(transactionRepo.store.size).toBe(1);
        expect(erpCashDocumentRepo.store.size).toBe(0);
    });

    it('успех ERP + сбой БД → компенсация: документ ERP удаляется, исходная ошибка пробрасывается, ничего не сохранено', async () => {
        const deleteCalls: DeleteErpCashDocumentParams[] = [];
        const erpPort: ErpCashDocumentPort = {
            create: () => Promise.resolve({ externalId: 'erp-comp' }),
            delete: (params) => {
                deleteCalls.push(params);
                return Promise.resolve();
            },
            findByKey: () => Promise.resolve(null),
        };
        const dbError = new Error('БД недоступна');
        const unitOfWork: UnitOfWorkPort = {
            run: () => Promise.reject(dbError),
        };
        const { handler, transactionRepo, erpCashDocumentRepo } = build({
            erpPort,
            unitOfWork,
        });
        await transactionRepo.insertMany([
            withRequestContext(() => importBonus(2000)),
        ]);

        await expect(
            withRequestContext(() =>
                handler.execute(command({ amount: 1000 })),
            ),
        ).rejects.toThrow(dbError);

        expect(transactionRepo.store.size).toBe(1);
        expect(erpCashDocumentRepo.store.size).toBe(0);
        expect(deleteCalls).toEqual([
            { externalId: 'erp-comp', kind: 'OUTCOME', amount: 1000 },
        ]);
    });

    it('остаток после операции ≤ 0 переводит ACCRUED-документы сотрудника направления service в PAID', async () => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const accrual = buildAccrual();
        accrualRepo.store.set(accrual.id, accrual);
        withRequestContext(() => accrual.accrueLine(accrual.lines[0].id));
        expect(accrual.status).toBe('ACCRUED');

        const {
            handler,
            transactionRepo,
            accrualRepo: repo,
        } = build({
            accrualRepo,
        });
        await transactionRepo.insertMany([
            withRequestContext(() => importBonus(1000)),
        ]);
        await withRequestContext(() =>
            handler.execute(command({ amount: 1000 })),
        );

        const saved = await repo.findById(accrual.id);
        expect(saved?.status).toBe('PAID');
        expect(saved?.lines.every((line) => line.status === 'PAID')).toBe(true);
    });

    it('остаток после операции > 0 НЕ переводит ACCRUED-документы в PAID', async () => {
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const accrual = buildAccrual();
        accrualRepo.store.set(accrual.id, accrual);
        withRequestContext(() => accrual.accrueLine(accrual.lines[0].id));

        const {
            handler,
            transactionRepo,
            accrualRepo: repo,
        } = build({
            accrualRepo,
        });
        await transactionRepo.insertMany([
            withRequestContext(() => importBonus(5000)),
        ]);
        await withRequestContext(() =>
            handler.execute(command({ amount: 1000 })),
        );

        const saved = await repo.findById(accrual.id);
        expect(saved?.status).toBe('ACCRUED');
    });

    it('две параллельные выплаты одному сотруднику сериализуются: ERP.create вызван дважды, обе выплаты списаны с одного остатка по очереди', async () => {
        const createCalls: CreateErpCashDocumentParams[] = [];
        const erpPort: ErpCashDocumentPort = {
            create: (params) => {
                createCalls.push(params);
                return Promise.resolve({
                    externalId: `erp-${createCalls.length}`,
                });
            },
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo } = build({ erpPort });
        await transactionRepo.insertMany([
            withRequestContext(() => importBonus(2000)),
        ]);

        const [first, second] = await withRequestContext(() =>
            Promise.all([
                handler.execute(command({ amount: 1000 })),
                handler.execute(command({ amount: 1000 })),
            ]),
        );

        expect(createCalls).toHaveLength(2);
        expect(first.transaction.amount).toBe(-1000);
        expect(second.transaction.amount).toBe(-1000);
        await expect(transactionRepo.sumByEmployee(42)).resolves.toBe(0);
    });
});

// Вспомогательное «прошлое» движение — приход, чтобы задать остаток
// сотрудника перед выплатой (в реальности — BONUS/начисление, здесь —
// произвольный приход через BalanceTransaction.createManual).
function importBonus(amount: number) {
    return BalanceTransaction.createManual({
        employeeId: 42,
        direction: 'service',
        type: 'BONUS',
        amount,
        createdBy: 7,
    });
}
