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
    }) => {
        const departmentFindMany = jest
            .fn()
            .mockResolvedValue(options.departments ?? []);
        const employeeFindMany = jest
            .fn()
            .mockResolvedValue(options.employees ?? []);

        const db = {
            bitrixDepartment: { findMany: departmentFindMany },
            bitrixEmployee: { findMany: employeeFindMany },
        } as unknown as DatabaseService;

        const repository = new DirectoryRepository(db);
        return { repository, departmentFindMany, employeeFindMany };
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
        it('без departmentId запрашивает сотрудников всех отделов (where: undefined)', async () => {
            const { repository, employeeFindMany } = buildRepository({});

            await repository.findEmployees();

            expect(employeeFindMany).toHaveBeenCalledWith({
                where: undefined,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    departmentId: true,
                    position: true,
                },
                orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            });
        });

        it('с departmentId фильтрует запрос по этому отделу', async () => {
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
                where: { departmentId: 3 },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    departmentId: true,
                    position: true,
                },
                orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            });
            expect(result).toEqual(employees);
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
});
