import { BitrixSyncService } from './bitrix-sync.service';
import type { BitrixUser } from '../../integrations/bitrix/bitrix-api.types';

// spec: auth#self-heal-bitrix-employee — upsertEmployeeRecord извлечён из
// uploadEmployees() (design.md, Migration Plan шаг 2) и переиспользуется
// BitrixEmployeeUpsertAdapter (BITRIX_EMPLOYEE_UPSERT_PORT) на пути логина;
// этот тест — регрессия на то, что массовый путь (npm run initial) не
// меняет поведение после извлечения.
describe('BitrixSyncService', () => {
    const buildUser = (overrides: Partial<BitrixUser> = {}): BitrixUser => ({
        ID: '42',
        NAME: 'Иван',
        LAST_NAME: 'Иванов',
        UF_DEPARTMENT: [7],
        ACTIVE: true,
        ...overrides,
    });

    const createService = (options: { existingDepartment?: boolean } = {}) => {
        const upsert = jest.fn().mockResolvedValue(undefined);
        const departmentFindUnique = jest
            .fn()
            .mockResolvedValue(
                options.existingDepartment === false ? null : { id: 7 },
            );
        const departmentUpsert = jest.fn().mockResolvedValue(undefined);
        const db = {
            bitrixEmployee: { upsert },
            bitrixDepartment: {
                findUnique: departmentFindUnique,
                upsert: departmentUpsert,
            },
        } as any;
        const bitrix = {
            fetchEmployees: jest.fn(),
            fetchDepartmentById: jest
                .fn()
                .mockResolvedValue({ ID: '7', NAME: 'Отдел продаж' }),
        } as any;
        const service = new BitrixSyncService(db, bitrix);
        return {
            service,
            db,
            bitrix,
            upsert,
            departmentFindUnique,
            departmentUpsert,
        };
    };

    describe('upsertEmployeeRecord', () => {
        it('апсертит одного сотрудника по данным Bitrix24', async () => {
            const { service, upsert } = createService();

            await service.upsertEmployeeRecord(buildUser());

            expect(upsert).toHaveBeenCalledWith({
                where: { id: 42 },
                create: {
                    id: 42,
                    firstName: 'Иван',
                    lastName: 'Иванов',
                    departmentId: 7,
                    isActive: true,
                },
                update: {
                    firstName: 'Иван',
                    lastName: 'Иванов',
                    isActive: true,
                },
            });
        });

        // spec: auth#self-heal-bitrix-employee — обнаруженный реальный баг: первый
        // вход сотрудника из ещё не встречавшегося отдела падал с нарушением FK
        // bitrix_employees_department_fkey, т.к. отдельной синхронизации отделов
        // в проекте нет. Отдел теперь самовосстанавливается тем же приёмом.
        it('подтягивает отдел из Bitrix24 и создаёт его локально, если он ещё не встречался', async () => {
            const { service, bitrix, departmentFindUnique, departmentUpsert } =
                createService({ existingDepartment: false });

            await service.upsertEmployeeRecord(buildUser());

            expect(departmentFindUnique).toHaveBeenCalledWith({
                where: { id: 7 },
                select: { id: true },
            });
            expect(bitrix.fetchDepartmentById).toHaveBeenCalledWith(7);
            expect(departmentUpsert).toHaveBeenCalledWith({
                where: { id: 7 },
                create: { id: 7, name: 'Отдел продаж' },
                update: {},
            });
        });

        it('не запрашивает Bitrix24, если отдел уже есть локально', async () => {
            const { service, bitrix, departmentUpsert } = createService({
                existingDepartment: true,
            });

            await service.upsertEmployeeRecord(buildUser());

            expect(bitrix.fetchDepartmentById).not.toHaveBeenCalled();
            expect(departmentUpsert).not.toHaveBeenCalled();
        });

        it('трактует отсутствие ACTIVE как "активен" (isActive: true)', async () => {
            const { service, upsert } = createService();

            await service.upsertEmployeeRecord(
                buildUser({ ACTIVE: undefined }),
            );

            expect(upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({ isActive: true }),
                }),
            );
        });

        it('ACTIVE: false отражается как isActive: false (уволенный сотрудник)', async () => {
            const { service, upsert } = createService();

            await service.upsertEmployeeRecord(buildUser({ ACTIVE: false }));

            expect(upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({ isActive: false }),
                    update: expect.objectContaining({ isActive: false }),
                }),
            );
        });
    });

    describe('uploadEmployees (регрессия массового пути)', () => {
        it('продолжает апсертить всех сотрудников из fetchEmployees() без изменения поведения', async () => {
            const { service, bitrix, upsert } = createService();
            const employees = [buildUser({ ID: '1' }), buildUser({ ID: '2' })];
            bitrix.fetchEmployees.mockResolvedValue(employees);

            const count = await service.uploadEmployees();

            expect(count).toBe(2);
            expect(upsert).toHaveBeenCalledTimes(2);
        });
    });
});
