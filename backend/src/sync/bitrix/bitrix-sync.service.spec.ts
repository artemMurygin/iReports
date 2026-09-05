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

    const createService = () => {
        const upsert = jest.fn().mockResolvedValue(undefined);
        const db = { bitrixEmployee: { upsert } } as any;
        const bitrix = { fetchEmployees: jest.fn() } as any;
        const service = new BitrixSyncService(db, bitrix);
        return { service, db, bitrix, upsert };
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

        it('трактует отсутствие ACTIVE как "активен" (isActive: true)', async () => {
            const { service, upsert } = createService();

            await service.upsertEmployeeRecord(buildUser({ ACTIVE: undefined }));

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
