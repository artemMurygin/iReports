import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { GetDepartmentBalancesService } from './get-department-balances.service';

// Сводка общих балансов по отделу (PRD 2, Фаза 7; общий баланс — Фаза 8b):
// состав — текущий отдел из Bitrix24; колонки — остаток (вся лента
// сотрудника независимо от направления) / начислено (движения начисления
// периода обоих направлений) / авансы / ручные (по дате движения внутри
// месяца); итог отдела равен сумме сотрудников.
describe('GetDepartmentBalancesService', () => {
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
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

    const accrualFor = (
        direction: 'service' | 'shop',
        employeeId: number,
        amounts: number[],
    ) =>
        withRequestContext(() =>
            SalaryAccrual.createFromSnapshot({
                direction,
                period: '2026-07',
                employeeId,
                isDismissed: false,
                total: amounts.reduce((sum, amount) => sum + amount, 0),
                lines: amounts.map((amount, index) => ({
                    ruleId: `rule-${direction}-${index}`,
                    type: 'PayPerHour',
                    name: 'Почасовая ставка',
                    targetRole: 'ENGINEER',
                    amount,
                    sources: [],
                })),
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

    it('раскладывает движения по колонкам (оба направления — одна лента), итоги отдела = сумма сотрудников, сотрудник без движений — нули', async () => {
        const { service, transactionRepo, accrualRepo } = build();

        // Документы начисления сотрудника 42 за 2026-07 в ОБОИХ
        // направлениях — источник accrualStatus и движений начисления.
        // Документ service проведён целиком (ACCRUED).
        const serviceAccrual = accrualFor('service', 42, [20000]);
        withRequestContext(() =>
            serviceAccrual.accrueLine(serviceAccrual.lines[0].id),
        );
        await accrualRepo.save(serviceAccrual);
        await transactionRepo.insertMany(
            withRequestContext(() =>
                BalanceTransaction.forAccruedLine(
                    serviceAccrual,
                    serviceAccrual.lines[0],
                    7,
                ),
            ),
        );
        // Документ shop проведён наполовину (PARTIALLY_ACCRUED): сводный
        // статус сотрудника — наименее продвинутый из документов за период.
        const shopAccrual = accrualFor('shop', 42, [5000, 3000]);
        withRequestContext(() =>
            shopAccrual.accrueLine(shopAccrual.lines[0].id),
        );
        await accrualRepo.save(shopAccrual);
        await transactionRepo.insertMany(
            withRequestContext(() =>
                BalanceTransaction.forAccruedLine(
                    shopAccrual,
                    shopAccrual.lines[0],
                    7,
                ),
            ),
        );

        await transactionRepo.insertMany([
            manual({ type: 'ADVANCE', amount: 5000 }),
            manual({ type: 'EXTRA_ADVANCE', amount: 2000 }),
            manual({ type: 'BONUS', amount: 3000 }),
            manual({ type: 'PENALTY', amount: 1000, comment: 'Опоздание' }),
            // Ручное движение происхождения shop — та же лента, та же
            // колонка «ручные»: направление на сводку не влияет.
            manual({ type: 'BONUS', amount: 500, direction: 'shop' }),
            // Вне месяца — в колонки не попадает, но в остатке участвует.
            manual({
                type: 'BONUS',
                amount: 700,
                occurredAt: new Date('2026-06-10T12:00:00.000Z'),
            }),
            // Другой сотрудник отдела.
            manual({ type: 'ADVANCE', amount: 4000, employeeId: 43 }),
        ]);

        const response = await service.execute(5, '2026-07');

        expect(response.departmentId).toBe(5);
        expect(response.period).toBe('2026-07');
        expect(response.employees).toHaveLength(2);

        const ivan = response.employees.find((row) => row.employeeId === 42);
        expect(ivan).toEqual({
            employeeId: 42,
            employeeName: 'Иван Петров',
            // 20000 + 5000 − 5000 − 2000 + 3000 − 1000 + 500 + 700
            // (июньская премия участвует в остатке, но не в колонках).
            balance: 21200,
            accrued: 25000,
            advances: -7000,
            manual: 2500,
            accrualStatus: 'PARTIALLY_ACCRUED',
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
            balance: 21200 - 4000,
            accrued: 25000,
            advances: -7000 - 4000,
            manual: 2500,
        });
    });

    it('удалённое ручное движение исчезает из сводки, отдел без сотрудников — пустая сводка с нулями', async () => {
        const { service, transactionRepo } = build();
        const advance = manual({ type: 'ADVANCE', amount: 5000 });
        await transactionRepo.insertMany([advance]);

        const before = await service.execute(5, '2026-07');
        const ivanBefore = before.employees.find(
            (row) => row.employeeId === 42,
        );
        expect(ivanBefore?.balance).toBe(-5000);
        expect(ivanBefore?.advances).toBe(-5000);

        // Ошибочное движение удаляется (Фаза 8b) — запись исчезает,
        // остаток и колонки пересчитываются.
        await transactionRepo.deleteById(advance.id);
        const after = await service.execute(5, '2026-07');
        const ivanAfter = after.employees.find((row) => row.employeeId === 42);
        expect(ivanAfter?.balance).toBe(0);
        expect(ivanAfter?.advances).toBe(0);
        expect(ivanAfter?.manual).toBe(0);

        const empty = await service.execute(777, '2026-07');
        expect(empty.employees).toEqual([]);
        expect(empty.totals).toEqual({
            balance: 0,
            accrued: 0,
            advances: 0,
            manual: 0,
        });
    });
});
