import { withRequestContext } from '@/shared/testing/with-request-context';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { ListEmployeesService } from '@/modules/directory/application/services/list-employees.service';
import { ReorderEmployeesHandler } from '@/modules/directory/application/command/reorder-employees.handler';
import { ReorderEmployeesCommand } from '@/modules/directory/application/command/reorder-employees.command';
import { ListSalaryAccrualsService } from '@/domains/service/modules/accounting/application/services/list-salary-accruals.service';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { GetDepartmentBalancesService } from '@/modules/employee-balance/application/services/get-department-balances.service';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';

// Интеграционный тест единого порядка сотрудников
// (docs/employee-ordering-and-salary-filter, Фаза 1, "интеграционный тест,
// проверяющий одинаковый порядок при запросе к справочнику, отчёту по
// зарплате и взаиморасчётам после reorder"). Три независимых, реально
// используемых в проде application-сервиса — справочник (ListEmployeesService,
// GET /v1/directory/employees), ведомость начислений периода
// (ListSalaryAccrualsService, "отчёт по зарплате") и сводка баланса отдела
// (GetDepartmentBalancesService, "взаиморасчёты/баланс") — подключаются к
// ОДНОМУ общему фейку DIRECTORY_REPOSITORY (тот же стейтфул-приём, что и в
// directory.e2e.spec.ts), через который ReorderEmployeesHandler сохраняет
// новый порядок. Критерий: после одного reorder все три сервиса отдают
// сотрудников в одном и том же новом порядке — не мокается на уровне HTTP,
// но проверяет ровно то бизнес-свойство, которое требует "Когда готово"
// Фазы 1 плана.
describe('Единый порядок сотрудников: справочник + отчёт по зарплате + взаиморасчёты (integration)', () => {
    const buildDirectoryFake = () => {
        const employees: {
            id: number;
            firstName: string;
            lastName: string;
            departmentId: number;
            order: number;
        }[] = [
            {
                id: 1,
                firstName: 'Иван',
                lastName: 'Иванов',
                departmentId: 5,
                order: 0,
            },
            {
                id: 2,
                firstName: 'Пётр',
                lastName: 'Петров',
                departmentId: 5,
                order: 1,
            },
            {
                id: 3,
                firstName: 'Анна',
                lastName: 'Сидорова',
                departmentId: 5,
                order: 2,
            },
        ];

        const repo: DirectoryRepositoryPort = {
            findDepartments: () => Promise.resolve([{ id: 5, name: 'Сервис' }]),
            findEmployees: (departmentId) =>
                Promise.resolve(
                    [...employees]
                        .sort((a, b) => a.order - b.order)
                        .filter(
                            (employee) =>
                                departmentId === undefined ||
                                employee.departmentId === departmentId,
                        )
                        .map(({ id, firstName, lastName, departmentId }) => ({
                            id,
                            firstName,
                            lastName,
                            departmentId,
                        })),
                ),
            updateEmployeesOrder: (items) => {
                for (const item of items) {
                    const employee = employees.find(
                        (e) => e.id === item.employeeId,
                    );
                    if (employee) {
                        employee.order = item.order;
                    }
                }
                return Promise.resolve();
            },
            // Ни один сотрудник этого фейка не служебный
            // (docs/employee-ordering-and-salary-filter, Фаза 3) — этот файл
            // проверяет порядок, а не фильтр.
            findServiceAccountEmployeeIds: () =>
                Promise.resolve(new Set<number>()),
            setServiceAccount: () => Promise.resolve(null),
        };
        return repo;
    };

    it('после reorder справочник, ведомость начислений и сводка баланса отдела отдают сотрудников в одном и том же новом порядке', async () => {
        const directoryRepo = buildDirectoryFake();
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const transactionRepo = new InMemoryBalanceTransactionRepository();

        // saveAll('service', '2026-07', ...) удаляет все строки того же
        // (direction, period) перед вставкой (см. InMemorySalaryAccrualRepository/
        // реальный SalaryAccrualRepository.saveAll) — поэтому по одному
        // сотруднику в отдельном вызове здесь нельзя, сеем все три сразу.
        await accrualRepo.saveAll(
            'service',
            '2026-07',
            [1, 2, 3].map((employeeId) =>
                withRequestContext(() =>
                    SalaryAccrual.createFromSnapshot({
                        direction: 'service',
                        period: '2026-07',
                        employeeId,
                        isDismissed: false,
                        total: 10000,
                        lines: [
                            {
                                ruleId: `rule-${employeeId}`,
                                type: 'PayPerHour',
                                name: 'Почасовая ставка',
                                targetRole: 'ENGINEER',
                                amount: 10000,
                                sources: [],
                            },
                        ],
                    }),
                ),
            ),
        );

        const listEmployees = new ListEmployeesService(directoryRepo);
        const listSalaryAccruals = new ListSalaryAccrualsService(
            accrualRepo,
            directoryRepo,
        );
        const getDepartmentBalances = new GetDepartmentBalancesService(
            transactionRepo,
            accrualRepo,
            directoryRepo,
        );
        const reorderHandler = new ReorderEmployeesHandler(directoryRepo);

        // Исходный порядок — по id (1, 2, 3), как засеяно выше — сверяем на
        // всех трёх поверхностях до reorder, чтобы тест доказывал именно
        // ИЗМЕНЕНИЕ порядка, а не случайное совпадение. Общий helper с явным
        // селектором (не эвристика employeeId ?? id) — у справочника поле
        // называется id, у ведомости начислений и сводки баланса —
        // employeeId (а id ведомости — строковый id самого документа
        // начисления, не сотрудника), так что единого поля не существует.
        const idsOf = <T>(rows: T[], selector: (row: T) => number) =>
            rows.map(selector);

        expect(idsOf(await listEmployees.execute(5), (e) => e.id)).toEqual([
            1, 2, 3,
        ]);
        expect(
            idsOf(
                (await listSalaryAccruals.execute('service', '2026-07')).items,
                (item) => item.employeeId,
            ),
        ).toEqual([1, 2, 3]);
        expect(
            idsOf(
                (await getDepartmentBalances.execute(5, '2026-07')).employees,
                (row) => row.employeeId,
            ),
        ).toEqual([1, 2, 3]);

        // Новый порядок: Анна(3), Иван(1), Пётр(2) — сохраняется одним
        // reorder-вызовом (тот же хендлер, что и у PATCH .../employees/order).
        await withRequestContext(() =>
            reorderHandler.execute(
                new ReorderEmployeesCommand({
                    items: [
                        { employeeId: 3, order: 0 },
                        { employeeId: 1, order: 1 },
                        { employeeId: 2, order: 2 },
                    ],
                }),
            ),
        );

        const newOrder = [3, 1, 2];
        expect(idsOf(await listEmployees.execute(5), (e) => e.id)).toEqual(
            newOrder,
        );
        expect(
            idsOf(
                (await listSalaryAccruals.execute('service', '2026-07')).items,
                (item) => item.employeeId,
            ),
        ).toEqual(newOrder);
        expect(
            idsOf(
                (await getDepartmentBalances.execute(5, '2026-07')).employees,
                (row) => row.employeeId,
            ),
        ).toEqual(newOrder);
    });
});
