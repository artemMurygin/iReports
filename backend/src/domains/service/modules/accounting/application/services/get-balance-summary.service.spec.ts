import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import type { EmployeeDismissalPort } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { GetBalanceSummaryService } from './get-balance-summary.service';

// Сквозной список взаиморасчётов (docs/employee-settlements-page-redesign,
// Фаза 1): без departmentId — все отделы; с departmentId — состав текущего
// отдела Bitrix24; search — регистронезависимая подстрока по «Имя Фамилия»,
// в рамках уже применённого фильтра по отделу. KPI считаются по итоговой
// (после фильтра/поиска) выборке. Уволенный сотрудник с ненулевым балансом
// остаётся в списке с isDismissed: true (не пропускается).
describe('GetBalanceSummaryService', () => {
    const departments = [
        { id: 5, name: 'Сервис' },
        { id: 6, name: 'Магазин' },
    ];
    const employees = [
        {
            id: 42,
            firstName: 'Иван',
            lastName: 'Петров',
            departmentId: 5,
            position: 'Инженер',
        },
        {
            id: 43,
            firstName: 'Пётр',
            lastName: 'Сидоров',
            departmentId: 5,
            position: null,
        },
        {
            id: 44,
            firstName: 'Анна',
            lastName: 'Кузнецова',
            departmentId: 6,
            position: 'Продавец',
        },
    ];
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve(departments),
        findEmployees: (departmentId) =>
            Promise.resolve(
                employees.filter(
                    (employee) =>
                        departmentId === undefined ||
                        employee.departmentId === departmentId,
                ),
            ),
    };
    // Сотрудник 43 уволен (BitrixEmployee.isActive = false), но остаётся в
    // списке из-за ненулевого баланса (PRD, "уволенный сотрудник с
    // ненулевым балансом ... с бейджем «Уволен»").
    const fakeDismissalRepo: EmployeeDismissalPort = {
        findDismissedEmployeeIds: (employeeIds) =>
            Promise.resolve(new Set(employeeIds.filter((id) => id === 43))),
    };

    // ADJUSTMENT — единственный ручной тип, у которого amount передаётся
    // явно со знаком (см. BalanceTransaction.createManual), удобен здесь,
    // чтобы тестовые суммы не зависели от таблицы приход/расход типов.
    const manual = (employeeId: number, amount: number, occurredAt: Date) =>
        withRequestContext(() =>
            BalanceTransaction.createManual({
                employeeId,
                direction: 'service',
                type: 'ADJUSTMENT',
                amount,
                createdBy: 7,
                occurredAt,
                comment: 'Тестовая корректировка',
            }),
        );

    const build = () => {
        const transactionRepo = new InMemoryBalanceTransactionRepository();
        const service = new GetBalanceSummaryService(
            transactionRepo,
            fakeDirectoryRepo,
            fakeDismissalRepo,
        );
        return { service, transactionRepo };
    };

    it('без departmentId возвращает сотрудников всех отделов с отделом/должностью/датой последнего движения и остатком', async () => {
        const { service, transactionRepo } = build();
        await transactionRepo.insertMany([
            manual(42, 5000, new Date('2026-07-01T10:00:00.000Z')),
            manual(42, -1000, new Date('2026-07-10T10:00:00.000Z')),
            manual(44, 2000, new Date('2026-07-05T10:00:00.000Z')),
        ]);

        const response = await service.execute('2026-07', {});

        expect(response.period).toBe('2026-07');
        expect(response.departmentId).toBeNull();
        expect(response.employees).toHaveLength(3);

        const ivan = response.employees.find((row) => row.employeeId === 42);
        expect(ivan).toEqual({
            employeeId: 42,
            employeeName: 'Иван Петров',
            departmentId: 5,
            departmentName: 'Сервис',
            position: 'Инженер',
            isDismissed: false,
            lastMovementAt: new Date('2026-07-10T10:00:00.000Z'),
            balance: 4000,
        });

        // Сотрудник 43 уволен (fakeDismissalRepo) — остаётся в списке
        // (даже без движений, баланс 0) с isDismissed: true.
        const petr = response.employees.find((row) => row.employeeId === 43);
        expect(petr).toEqual({
            employeeId: 43,
            employeeName: 'Пётр Сидоров',
            departmentId: 5,
            departmentName: 'Сервис',
            position: null,
            isDismissed: true,
            lastMovementAt: null,
            balance: 0,
        });

        const anna = response.employees.find((row) => row.employeeId === 44);
        expect(anna).toEqual({
            employeeId: 44,
            employeeName: 'Анна Кузнецова',
            departmentId: 6,
            departmentName: 'Магазин',
            position: 'Продавец',
            isDismissed: false,
            lastMovementAt: new Date('2026-07-05T10:00:00.000Z'),
            balance: 2000,
        });
    });

    it('с departmentId сужает состав до сотрудников этого отдела (KPI считаются по сузенной выборке)', async () => {
        const { service, transactionRepo } = build();
        await transactionRepo.insertMany([
            manual(42, 5000, new Date('2026-07-01T10:00:00.000Z')),
            manual(44, 2000, new Date('2026-07-05T10:00:00.000Z')),
        ]);

        const response = await service.execute('2026-07', {
            departmentId: 5,
        });

        expect(response.departmentId).toBe(5);
        expect(response.employees.map((row) => row.employeeId).sort()).toEqual([
            42, 43,
        ]);
        // Сотрудник другого отдела (44) не участвует ни в списке, ни в KPI.
        expect(response.totals.balance).toBe(5000);
    });

    it('search сужает список по подстроке имени независимо от регистра, в рамках уже выбранного отдела/всех отделов', async () => {
        const { service } = build();

        // «петр» — подстрока фамилии «Петров» (без «ё»), не совпадает с
        // именем «Пётр» — теми же буквами регистр не путает орфографию.
        const allDepartments = await service.execute('2026-07', {
            search: 'ПЕТР',
        });
        expect(allDepartments.employees.map((row) => row.employeeName)).toEqual(
            ['Иван Петров'],
        );

        const withinDepartment = await service.execute('2026-07', {
            departmentId: 6,
            search: 'петр',
        });
        expect(withinDepartment.employees).toEqual([]);
    });

    it('KPI: общий остаток, «к выплате» (положительные) и «долг» (отрицательные) считаются по итоговой выборке', async () => {
        const { service, transactionRepo } = build();
        await transactionRepo.insertMany([
            manual(42, 5000, new Date('2026-07-01T10:00:00.000Z')),
            manual(43, -2000, new Date('2026-07-02T10:00:00.000Z')),
            // 44 остаётся с нулевым балансом — не попадает ни в toPay, ни в debt.
        ]);

        const response = await service.execute('2026-07', {});

        expect(response.totals).toEqual({
            balance: 5000 - 2000,
            toPay: { amount: 5000, count: 1 },
            debt: { amount: -2000, count: 1 },
        });
    });

    it('уволенный сотрудник с ненулевым балансом остаётся в списке с isDismissed: true', async () => {
        const { service, transactionRepo } = build();
        await transactionRepo.insertMany([
            manual(43, -3000, new Date('2026-07-03T10:00:00.000Z')),
        ]);

        const response = await service.execute('2026-07', {
            departmentId: 5,
        });

        const petr = response.employees.find((row) => row.employeeId === 43);
        expect(petr?.isDismissed).toBe(true);
        expect(petr?.balance).toBe(-3000);
        expect(response.totals.debt).toEqual({ amount: -3000, count: 1 });
    });
});
