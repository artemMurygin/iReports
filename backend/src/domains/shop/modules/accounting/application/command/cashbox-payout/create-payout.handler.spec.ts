import type { ErpCashDocumentKind } from 'ireports-contracts';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { EmployeeOperationLock } from '@/shared/infrastructure/sync-lock/employee-operation-lock';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type {
    CreateErpCashDocumentParams,
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
} from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-document.port';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { PayoutConfirmationRequiredException } from '@/modules/employee-balance/domain/exceptions/salary-payout.exception';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { InMemoryPayoutCashboxRecordRepository as InMemoryShopPayoutCashboxRecordRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/cashbox/in-memory-payout-cashbox-record.repository';
import { InMemoryPayoutCashboxRecordRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/erp-cash/in-memory-payout-cashbox-record.repository';
import { InMemoryShopSalaryAccrualRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import type { ErpCashDocumentPort as ServiceErpCashDocumentPort } from '@/domains/service/modules/accounting/application/ports/erp-cash/erp-cash-document.port';
import { CreatePayoutHandler } from '@/domains/service/modules/accounting/application/command/create-payout.handler';
import { CreatePayoutCommand } from '@/domains/service/modules/accounting/application/command/create-payout.command';
import { CreateShopPayoutHandler } from './create-payout.handler';
import { CreateShopPayoutCommand } from './create-payout.command';

// Выплата направления shop (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 12) — зеркалит create-payout.handler.spec.ts направления service:
// подтверждение при нулевом/отрицательном остатке или сумме больше остатка,
// синхронный порядок «ERP (МойСклад) → БД» с компенсацией, переход
// ACCRUED → PAID при остатке после операции ≤ 0, блокировка по сотруднику.
describe('CreateShopPayoutHandler', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
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
            ShopSalaryAccrual.createFromSnapshot({
                period: '2026-07',
                employeeId,
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
        accrualRepo?: InMemoryShopSalaryAccrualRepository;
    }) => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const accrualRepo =
            overrides?.accrualRepo ?? new InMemoryShopSalaryAccrualRepository();
        const payoutCashboxRecordRepo =
            new InMemoryShopPayoutCashboxRecordRepository();
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
        const handler = new CreateShopPayoutHandler(
            transactionRepo,
            accrualRepo,
            fakeErpPort,
            payoutCashboxRecordRepo,
            fakeDirectoryRepo,
            unitOfWork,
            employeeLock,
        );
        return {
            handler,
            transactionRepo,
            accrualRepo,
            payoutCashboxRecordRepo,
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
        new CreateShopPayoutCommand({
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
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
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
            direction: 'shop',
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

        const document = await payoutCashboxRecordRepo.findByTransactionId(
            response.transaction.id,
        );
        expect(document).toMatchObject({
            externalId: 'erp-1',
            kind: 'OUTCOME',
            system: 'MOY_SKLAD',
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
            create: () => Promise.reject(new Error('МойСклад недоступен')),
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
            erpPort,
        });
        await transactionRepo.insertMany([
            withRequestContext(() => importBonus(2000)),
        ]);

        await expect(
            withRequestContext(() =>
                handler.execute(command({ amount: 1000 })),
            ),
        ).rejects.toThrow('МойСклад недоступен');

        expect(transactionRepo.store.size).toBe(1);
        expect(payoutCashboxRecordRepo.store.size).toBe(0);
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
        const { handler, transactionRepo, payoutCashboxRecordRepo } = build({
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
        expect(payoutCashboxRecordRepo.store.size).toBe(0);
        expect(deleteCalls).toEqual([
            { externalId: 'erp-comp', kind: 'OUTCOME', amount: 1000 },
        ]);
    });

    it('остаток после операции ≤ 0 переводит ACCRUED-документы сотрудника направления shop в PAID', async () => {
        const accrualRepo = new InMemoryShopSalaryAccrualRepository();
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
        const accrualRepo = new InMemoryShopSalaryAccrualRepository();
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

    it('выплата направления service того же сотрудника НЕ переводит ACCRUED-документ shop в PAID (изоляция per direction)', async () => {
        // Регресс на решённый архитектурный вопрос Фазы 12, теперь
        // структурно гарантированный Фазой 6 docs/service-shop-boundary-violations-fix:
        // markPaid() трогает только документы СВОЕГО направления (см. WHY на
        // ShopSalaryAccrual.markPaid и CreateShopPayoutHandler/
        // CreatePayoutHandler) — с Фазы 6 у каждого направления собственный
        // независимый репозиторий/хранилище документов начисления
        // (SHOP_SALARY_ACCRUAL_REPOSITORY у shop, SALARY_ACCRUAL_REPOSITORY у
        // service), поэтому операция выплаты направления service физически
        // не может задеть документ shop — они больше не в одном сторе.
        // CreatePayoutHandler (service) используется напрямую со СВОИМ,
        // отдельным (пустым) accrualRepo — та же BALANCE_TRANSACTION_REPOSITORY
        // (общий баланс, employee-balance), но порт ERP — фейк service.
        const shopAccrualRepo = new InMemoryShopSalaryAccrualRepository();
        const shopAccrual = buildAccrual();
        shopAccrualRepo.store.set(shopAccrual.id, shopAccrual);
        withRequestContext(() =>
            shopAccrual.accrueLine(shopAccrual.lines[0].id),
        );
        expect(shopAccrual.status).toBe('ACCRUED');

        const { transactionRepo } = build({ accrualRepo: shopAccrualRepo });
        const serviceAccrualRepo = new InMemorySalaryAccrualRepository();
        const serviceErpPort: ServiceErpCashDocumentPort = {
            create: (params) =>
                Promise.resolve({ externalId: `erp-${params.transactionId}` }),
            delete: () => Promise.resolve(),
            findByKey: () => Promise.resolve(null),
        };
        const serviceHandler = new CreatePayoutHandler(
            transactionRepo,
            serviceAccrualRepo,
            serviceErpPort,
            new InMemoryPayoutCashboxRecordRepository(),
            fakeDirectoryRepo,
            { run: (work) => work() },
            new EmployeeOperationLock(),
        );

        await withRequestContext(() =>
            serviceHandler.execute(
                new CreatePayoutCommand({
                    employeeId: 42,
                    amount: 1000,
                    createdBy: 7,
                    confirmNegativeBalance: true,
                }),
            ),
        );
        await expect(transactionRepo.sumByEmployee(42)).resolves.toBe(-1000);

        const saved = await shopAccrualRepo.findById(shopAccrual.id);
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
        direction: 'shop',
        type: 'BONUS',
        amount,
        createdBy: 7,
    });
}
