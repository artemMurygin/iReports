import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { GetDepartmentBalancesService } from './get-department-balances.service';

// Сводка балансов по отделу (PRD 2, Фаза 7): состав — текущий отдел из
// Bitrix24; колонки — остаток (вся лента) / начислено (движения начисления
// периода) / авансы / ручные (по дате движения внутри месяца); итог отдела
// равен сумме сотрудников.
describe('GetDepartmentBalancesService', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        findEmployees: (departmentId) =>
            Promise.resolve(
                [
                    {
                        id: 42,
                        firstName: 'Иван',
                        lastName: 'Петров',
                        departmentId: 5,
                    },
                    {
                        id: 43,
                        firstName: 'Пётр',
                        lastName: 'Сидоров',
                        departmentId: 5,
                    },
                    {
                        id: 99,
                        firstName: 'Чужой',
                        lastName: 'Отдел',
                        departmentId: 8,
                    },
                ].filter(
                    (employee) =>
                        departmentId === undefined ||
                        employee.departmentId === departmentId,
                ),
            ),
    };

    const manual = (
        overrides: Partial<
            Parameters<typeof BalanceTransaction.createManual>[0]
        > &
            Pick<
                Parameters<typeof BalanceTransaction.createManual>[0],
                'type' | 'amount'
            >,
    ) =>
        withRequestContext(() =>
            BalanceTransaction.createManual({
                employeeId: 42,
                direction: 'service',
                createdBy: 7,
                occurredAt: new Date('2026-07-10T12:00:00.000Z'),
                ...overrides,
            }),
        );

    const build = () => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const service = new GetDepartmentBalancesService(
            transactionRepo,
            accrualRepo,
            fakeDirectoryRepo,
        );
        return { service, transactionRepo, accrualRepo };
    };

    it('раскладывает движения по колонкам, итоги отдела = сумма сотрудников, сотрудник без движений — нули', async () => {
        const { service, transactionRepo, accrualRepo } = build();

        // Документ начисления сотрудника 42 за 2026-07 — источник
        // accrualStatus и движений начисления.
        const accrual = withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction: 'service',
                period: '2026-07',
                employeeId: 42,
                isDismissed: false,
                total: 20000,
                lines: [
                    {
                        ruleId: 'rule-1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        amount: 20000,
                        sources: [],
                    },
                ],
            }),
        );
        withRequestContext(() => accrual.accrueLine(accrual.lines[0].id));
        await accrualRepo.save(accrual);
        // Движение начисления периода: occurredAt — момент проведения (уже
        // август), в колонку «начислено» оно попадает по полю period.
        const accrualTransactions = withRequestContext(() =>
            BalanceTransaction.forAccruedLine(accrual, accrual.lines[0], 7),
        );
        await transactionRepo.insertMany(accrualTransactions);

        await transactionRepo.insertMany([
            manual({ type: 'ADVANCE', amount: 5000 }),
            manual({ type: 'EXTRA_ADVANCE', amount: 2000 }),
            manual({ type: 'BONUS', amount: 3000 }),
            manual({ type: 'PENALTY', amount: 1000, comment: 'Опоздание' }),
            // Вне месяца — в колонки не попадает, но в остатке участвует.
            manual({
                type: 'BONUS',
                amount: 700,
                occurredAt: new Date('2026-06-10T12:00:00.000Z'),
            }),
            // Другой сотрудник отдела.
            manual({ type: 'ADVANCE', amount: 4000, employeeId: 43 }),
            // Чужое направление — сводка направления service его не видит.
            manual({ type: 'ADVANCE', amount: 9999, direction: 'shop' }),
        ]);

        const response = await service.execute('service', 5, '2026-07');

        expect(response.departmentId).toBe(5);
        expect(response.period).toBe('2026-07');
        expect(response.employees).toHaveLength(2);

        const ivan = response.employees.find((row) => row.employeeId === 42);
        expect(ivan).toEqual({
            employeeId: 42,
            employeeName: 'Иван Петров',
            // 20000 − 5000 − 2000 + 3000 − 1000 + 700 (июньская премия
            // участвует в остатке, но не в колонках месяца).
            balance: 15700,
            accrued: 20000,
            advances: -7000,
            manual: 2000,
            accrualStatus: 'ACCRUED',
        });

        const petr = response.employees.find((row) => row.employeeId === 43);
        expect(petr).toEqual({
            employeeId: 43,
            employeeName: 'Пётр Сидоров',
            balance: -4000,
            accrued: 0,
            advances: -4000,
            manual: 0,
            accrualStatus: null,
        });

        // Итог по отделу — сумма сотрудников (критерий PRD 2).
        expect(response.totals).toEqual({
            balance: 15700 - 4000,
            accrued: 20000,
            advances: -7000 - 4000,
            manual: 2000,
        });
    });

    it('сторно попадает в колонку «ручные» месяца своей даты, отдел без сотрудников — пустая сводка с нулями', async () => {
        const { service, transactionRepo } = build();
        const advance = manual({ type: 'ADVANCE', amount: 5000 });
        await transactionRepo.insertMany([advance]);
        // Сторно датируется моментом исправления (сейчас), а не датой
        // исходного движения: июльский аванс, сторнированный в текущем
        // месяце, честно виден в «ручных» текущего месяца.
        const reversal = withRequestContext(() =>
            BalanceTransaction.reversalOf(advance, 'Ошибка', 9),
        );
        await transactionRepo.insertMany([reversal]);

        const july = await service.execute('service', 5, '2026-07');
        const ivanJuly = july.employees.find((row) => row.employeeId === 42);
        expect(ivanJuly?.balance).toBe(0);
        expect(ivanJuly?.advances).toBe(-5000);
        expect(ivanJuly?.manual).toBe(0);

        const now = new Date();
        const currentPeriod = `${now.getUTCFullYear()}-${String(
            now.getUTCMonth() + 1,
        ).padStart(2, '0')}`;
        const current = await service.execute('service', 5, currentPeriod);
        const ivanNow = current.employees.find((row) => row.employeeId === 42);
        expect(ivanNow?.manual).toBe(5000);

        const empty = await service.execute('service', 777, '2026-07');
        expect(empty.employees).toEqual([]);
        expect(empty.totals).toEqual({
            balance: 0,
            accrued: 0,
            advances: 0,
            manual: 0,
        });
    });
});
