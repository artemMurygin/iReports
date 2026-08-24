import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { GetPayoutPageService } from './get-payout-page.service';

// Страница выплаты направления service (PRD 3, «Контракты»): payoutStatus и
// срезы accrued/advances/manual/paid — только по своему направлению; итог —
// сумма строк.
describe('GetPayoutPageService', () => {
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

    const buildAccrual = () =>
        withRequestContext(() =>
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

    it('строка сотрудника: accrued/advances/manual только своего направления, balance общий, payoutStatus по остатку/paid', async () => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const accrual = buildAccrual();
        accrualRepo.store.set(accrual.id, accrual);

        await transactionRepo.insertMany(
            [
                withRequestContext(() =>
                    BalanceTransaction.forAccruedLine(
                        accrual,
                        accrual.lines[0],
                        7,
                    ),
                ),
            ].flat(),
        );
        // Ручной аванс этого месяца, направление service.
        await transactionRepo.insertMany([
            withRequestContext(() =>
                BalanceTransaction.createManual({
                    employeeId: 42,
                    direction: 'service',
                    type: 'ADVANCE',
                    amount: 500,
                    createdBy: 7,
                    occurredAt: new Date('2026-07-10T00:00:00.000Z'),
                }),
            ),
        ]);
        // Движение того же периода, но направления shop — не должно попасть
        // в срезы страницы service.
        await transactionRepo.insertMany([
            withRequestContext(() =>
                BalanceTransaction.createManual({
                    employeeId: 42,
                    direction: 'shop',
                    type: 'BONUS',
                    amount: 10_000,
                    createdBy: 7,
                    occurredAt: new Date('2026-07-12T00:00:00.000Z'),
                }),
            ),
        ]);
        // Частичная выплата этого месяца, направление service.
        await transactionRepo.insertMany([
            withRequestContext(() =>
                BalanceTransaction.forPayout({
                    employeeId: 42,
                    direction: 'service',
                    amount: 300,
                    createdBy: 7,
                    occurredAt: new Date('2026-07-20T00:00:00.000Z'),
                }),
            ),
        ]);

        const service = new GetPayoutPageService(
            transactionRepo,
            accrualRepo,
            fakeDirectoryRepo,
        );
        const response = await service.execute('2026-07');

        expect(response.direction).toBe('service');
        expect(response.employees).toHaveLength(1);
        const row = response.employees[0];
        expect(row).toMatchObject({
            employeeId: 42,
            name: 'Иван Петров',
            accrued: 2000,
            advances: -500,
            manual: 0,
            paid: -300,
        });
        // balance — SUM ВСЕЙ ленты, включая движение направления shop:
        // 2000 - 500 + 10000 - 300 = 11200.
        expect(row.balance).toBe(11_200);
        expect(row.payoutStatus).toBe('PARTIALLY_PAID');

        expect(response.totals).toEqual({
            accrued: 2000,
            advances: -500,
            manual: 0,
            balance: 11_200,
            paid: -300,
        });
    });

    it('остаток ≤ 0 — payoutStatus PAID; ещё не было выплат — NOT_PAID', async () => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const accrual = buildAccrual();
        accrualRepo.store.set(accrual.id, accrual);
        await transactionRepo.insertMany(
            withRequestContext(() =>
                BalanceTransaction.forAccruedLine(accrual, accrual.lines[0], 7),
            ),
        );

        const service = new GetPayoutPageService(
            transactionRepo,
            accrualRepo,
            fakeDirectoryRepo,
        );

        const notPaid = await service.execute('2026-07');
        expect(notPaid.employees[0].payoutStatus).toBe('NOT_PAID');

        await transactionRepo.insertMany([
            withRequestContext(() =>
                BalanceTransaction.forPayout({
                    employeeId: 42,
                    direction: 'service',
                    amount: 2000,
                    createdBy: 7,
                }),
            ),
        ]);
        const paid = await service.execute('2026-07');
        expect(paid.employees[0].payoutStatus).toBe('PAID');
        expect(paid.employees[0].balance).toBe(0);
    });
});
