import { withRequestContext } from '@/shared/testing/with-request-context';
import { ReorderEmployeesHandler } from './reorder-employees.handler';
import { ReorderEmployeesCommand } from './reorder-employees.command';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';

// Юнит-тест reorder-эндпоинта (docs/employee-ordering-and-salary-filter,
// Фаза 1, "unit-тест на reorder-эндпоинт (сохранение и повторное чтение
// порядка)") — на уровне хендлера, а не HTTP: DirectoryRepositoryPort
// фейкуется стейтфул-хранилищем (тот же приём, что и у
// UpsertWorkScheduleEntryHandler.spec.ts), чтобы updateEmployeesOrder →
// findEmployees внутри одного execute() проверяли реальное «сохранение и
// повторное чтение», а не только то, что методы были вызваны.
describe('ReorderEmployeesHandler', () => {
    const buildHandler = (
        initialEmployees: {
            id: number;
            firstName: string;
            lastName: string;
            departmentId: number;
            order: number;
        }[],
    ) => {
        const employees = [...initialEmployees];
        const updateEmployeesOrder = jest.fn(
            (items: { employeeId: number; order: number }[]) => {
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
        );
        const findEmployees = jest.fn(() =>
            Promise.resolve(
                [...employees]
                    .sort((a, b) => a.order - b.order)
                    .map(({ id, firstName, lastName, departmentId }) => ({
                        id,
                        firstName,
                        lastName,
                        departmentId,
                    })),
            ),
        );
        const repo: DirectoryRepositoryPort = {
            findDepartments: jest.fn(),
            findEmployees,
            updateEmployeesOrder,
            findServiceAccountEmployeeIds: () =>
                Promise.resolve(new Set<number>()),
            setServiceAccount: () => Promise.resolve(null),
        };
        const handler = new ReorderEmployeesHandler(repo);
        return { handler, updateEmployeesOrder, findEmployees };
    };

    it('сохраняет новый порядок и возвращает справочник уже в этом порядке', async () => {
        const { handler, updateEmployeesOrder, findEmployees } = buildHandler([
            {
                id: 1,
                firstName: 'Иван',
                lastName: 'Иванов',
                departmentId: 1,
                order: 0,
            },
            {
                id: 2,
                firstName: 'Пётр',
                lastName: 'Петров',
                departmentId: 1,
                order: 1,
            },
        ]);
        const result = await withRequestContext(() =>
            handler.execute(
                new ReorderEmployeesCommand({
                    items: [
                        { employeeId: 2, order: 0 },
                        { employeeId: 1, order: 1 },
                    ],
                }),
            ),
        );

        expect(updateEmployeesOrder).toHaveBeenCalledWith([
            { employeeId: 2, order: 0 },
            { employeeId: 1, order: 1 },
        ]);
        expect(findEmployees).toHaveBeenCalledTimes(1);
        expect(result).toEqual([
            { id: 2, name: 'Пётр Петров', departmentId: 1 },
            { id: 1, name: 'Иван Иванов', departmentId: 1 },
        ]);
    });

    it('сохранённый порядок переживает независимый повторный вызов хендлера (эмуляция отдельного GET после PATCH)', async () => {
        const { handler, findEmployees } = buildHandler([
            {
                id: 1,
                firstName: 'Иван',
                lastName: 'Иванов',
                departmentId: 1,
                order: 0,
            },
            {
                id: 2,
                firstName: 'Пётр',
                lastName: 'Петров',
                departmentId: 1,
                order: 1,
            },
        ]);

        await withRequestContext(() =>
            handler.execute(
                new ReorderEmployeesCommand({
                    items: [
                        { employeeId: 2, order: 0 },
                        { employeeId: 1, order: 1 },
                    ],
                }),
            ),
        );

        // Второй, полностью независимый вызов findEmployees (как отдельный
        // последующий GET /v1/directory/employees) должен по-прежнему
        // отдавать порядок, сохранённый первым вызовом — не только
        // немедленный ответ того же PATCH.
        const rereadResult = await findEmployees();

        expect(rereadResult.map((employee) => employee.id)).toEqual([2, 1]);
    });
});
