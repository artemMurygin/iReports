import { DirectoryRepository } from './directory.repository';
import type { DatabaseService } from '@/infrustructure/database/database.service';

describe('DirectoryRepository', () => {
    const buildRepository = (options: {
        departments?: { id: number; name: string }[];
        employees?: {
            id: number;
            firstName: string;
            lastName: string;
            departmentId: number;
        }[];
        // findUnique/update мока setServiceAccount (Фаза 3) — undefined,
        // если конкретный тест их не задействует.
        existingEmployee?: { id: number } | null;
        updatedEmployee?: {
            id: number;
            firstName: string;
            lastName: string;
            departmentId: number;
            position: string | null;
            isServiceAccount: boolean;
        };
    }) => {
        const departmentFindMany = jest
            .fn()
            .mockResolvedValue(options.departments ?? []);
        const employeeFindMany = jest
            .fn()
            .mockResolvedValue(options.employees ?? []);

        const employeeUpdate = jest
            .fn()
            .mockResolvedValue(options.updatedEmployee);
        const employeeFindUnique = jest
            .fn()
            .mockResolvedValue(options.existingEmployee ?? null);
        const $transaction = jest.fn((ops: unknown[]) => Promise.all(ops));

        const db = {
            bitrixDepartment: { findMany: departmentFindMany },
            bitrixEmployee: {
                findMany: employeeFindMany,
                findUnique: employeeFindUnique,
                update: employeeUpdate,
            },
            $transaction,
        } as unknown as DatabaseService;

        const repository = new DirectoryRepository(db);
        return {
            repository,
            departmentFindMany,
            employeeFindMany,
            employeeFindUnique,
            employeeUpdate,
            $transaction,
        };
    };

    describe('findDepartments', () => {
        it('отдаёт отделы как есть из Prisma, отсортированными по имени', async () => {
            const departments = [
                { id: 1, name: 'Сервис' },
                { id: 2, name: 'Магазин' },
            ];
            const { repository, departmentFindMany } = buildRepository({
                departments,
            });

            const result = await repository.findDepartments();

            expect(departmentFindMany).toHaveBeenCalledWith({
                select: { id: true, name: true },
                orderBy: { name: 'asc' },
            });
            expect(result).toEqual(departments);
        });
    });

    describe('findEmployees', () => {
        it('без departmentId и без опций — фильтрует по isServiceAccount: false (Фаза 3), сотрудников всех отделов', async () => {
            const { repository, employeeFindMany } = buildRepository({});

            await repository.findEmployees();

            expect(employeeFindMany).toHaveBeenCalledWith({
                where: { isServiceAccount: false },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    departmentId: true,
                    position: true,
                    isServiceAccount: true,
                },
                orderBy: { order: 'asc' },
            });
        });

        it('с departmentId фильтрует запрос по этому отделу и по isServiceAccount: false', async () => {
            const employees = [
                {
                    id: 7,
                    firstName: 'Пётр',
                    lastName: 'Петров',
                    departmentId: 3,
                },
            ];
            const { repository, employeeFindMany } = buildRepository({
                employees,
            });

            const result = await repository.findEmployees(3);

            expect(employeeFindMany).toHaveBeenCalledWith({
                where: { departmentId: 3, isServiceAccount: false },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    departmentId: true,
                    position: true,
                    isServiceAccount: true,
                },
                orderBy: { order: 'asc' },
            });
            expect(result).toEqual(employees);
        });

        // docs/employee-ordering-and-salary-filter, Фаза 3 —
        // includeServiceAccounts: true обходит фильтр isServiceAccount:
        // false целиком (эндпоинты графика работы/связей сотрудников).
        it('includeServiceAccounts: true — не задаёт фильтр isServiceAccount в where', async () => {
            const { repository, employeeFindMany } = buildRepository({});

            await repository.findEmployees(3, {
                includeServiceAccounts: true,
            });

            expect(employeeFindMany).toHaveBeenCalledWith({
                where: { departmentId: 3 },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    departmentId: true,
                    position: true,
                    isServiceAccount: true,
                },
                orderBy: { order: 'asc' },
            });
        });

        it('фильтр по одному отделу не возвращает сотрудников другого отдела', async () => {
            // buildRepository мокает findMany целиком (без реальной фильтрации
            // в Prisma-слое) — здесь фейк сам применяет departmentId к
            // исходному набору, чтобы зафиксировать ожидаемое поведение
            // запроса на уровне контракта репозитория, а не только аргументов
            // вызова.
            const allEmployees = [
                {
                    id: 42,
                    firstName: 'Иван',
                    lastName: 'Иванов',
                    departmentId: 1,
                },
                {
                    id: 7,
                    firstName: 'Пётр',
                    lastName: 'Петров',
                    departmentId: 2,
                },
            ];
            const employeeFindMany = jest.fn(
                (args: { where?: { departmentId: number } }) =>
                    Promise.resolve(
                        allEmployees.filter(
                            (employee) =>
                                args.where === undefined ||
                                employee.departmentId ===
                                    args.where.departmentId,
                        ),
                    ),
            );
            const db = {
                bitrixDepartment: { findMany: jest.fn() },
                bitrixEmployee: { findMany: employeeFindMany },
            } as unknown as DatabaseService;
            const repository = new DirectoryRepository(db);

            const result = await repository.findEmployees(2);

            expect(result).toEqual([
                {
                    id: 7,
                    firstName: 'Пётр',
                    lastName: 'Петров',
                    departmentId: 2,
                },
            ]);
        });
    });

    describe('updateEmployeesOrder', () => {
        it('обновляет order каждого сотрудника одной транзакцией', async () => {
            const { repository, employeeUpdate, $transaction } =
                buildRepository({});

            await repository.updateEmployeesOrder([
                { employeeId: 7, order: 1 },
                { employeeId: 42, order: 0 },
            ]);

            expect($transaction).toHaveBeenCalledTimes(1);
            expect(employeeUpdate).toHaveBeenCalledWith({
                where: { id: 7 },
                data: { order: 1 },
            });
            expect(employeeUpdate).toHaveBeenCalledWith({
                where: { id: 42 },
                data: { order: 0 },
            });
        });

        it('с пустым списком ничего не пишет', async () => {
            const { repository, $transaction } = buildRepository({});

            await repository.updateEmployeesOrder([]);

            expect($transaction).not.toHaveBeenCalled();
        });
    });

    // docs/employee-ordering-and-salary-filter, Фаза 3.
    describe('findServiceAccountEmployeeIds', () => {
        it('запрашивает только id сотрудников с isServiceAccount: true', async () => {
            const { repository, employeeFindMany } = buildRepository({});

            await repository.findServiceAccountEmployeeIds();

            expect(employeeFindMany).toHaveBeenCalledWith({
                where: { isServiceAccount: true },
                select: { id: true },
            });
        });

        it('возвращает Set из id найденных сотрудников', async () => {
            const { repository, employeeFindMany } = buildRepository({});
            employeeFindMany.mockResolvedValue([{ id: 5 }, { id: 9 }]);

            const result = await repository.findServiceAccountEmployeeIds();

            expect(result).toEqual(new Set([5, 9]));
        });
    });

    describe('setServiceAccount', () => {
        it('сотрудник не найден — возвращает null и не вызывает update', async () => {
            const { repository, employeeFindUnique, employeeUpdate } =
                buildRepository({ existingEmployee: null });

            const result = await repository.setServiceAccount(999, true);

            expect(result).toBeNull();
            expect(employeeFindUnique).toHaveBeenCalledWith({
                where: { id: 999 },
                select: { id: true },
            });
            expect(employeeUpdate).not.toHaveBeenCalled();
        });

        it('сотрудник найден — пишет isServiceAccount и возвращает обновлённую запись целиком', async () => {
            const updatedEmployee = {
                id: 42,
                firstName: 'Иван',
                lastName: 'Иванов',
                departmentId: 1,
                position: null,
                isServiceAccount: true,
            };
            const { repository, employeeUpdate } = buildRepository({
                existingEmployee: { id: 42 },
                updatedEmployee,
            });

            const result = await repository.setServiceAccount(42, true);

            expect(employeeUpdate).toHaveBeenCalledWith({
                where: { id: 42 },
                data: { isServiceAccount: true },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    departmentId: true,
                    position: true,
                    isServiceAccount: true,
                },
            });
            expect(result).toEqual(updatedEmployee);
        });
    });
});
