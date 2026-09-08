import { withRequestContext } from '@/shared/testing/with-request-context';
import { GetMotivationSchemaService } from './get-motivation-schema.service';
import { NotFoundException } from '@/shared/exceptions';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';

describe('GetMotivationSchemaService', () => {
    const buildSchema = (
        targetType: 'Department' | 'Employee',
        targetId: number,
        ruleCount: number,
    ) => {
        const rules = Array.from({ length: ruleCount }, (_, index) =>
            PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: `Часы ${index}`,
                targetRole: 'ENGINEER',
                config: { price: 100 },
            }),
        );

        return MotivationSchema.create({
            targetType,
            targetId,
            name: 'Оклад',
            rules,
        });
    };

    const buildService = (schema: MotivationSchema | null) => {
        const findById = jest
            .fn<Promise<MotivationSchema | null>, [string]>()
            .mockResolvedValue(schema);
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
            findById,
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
            initializeName: jest.fn(),
        };
        const findDepartments = jest
            .fn()
            .mockResolvedValue([{ id: 1, name: 'Сервисный отдел' }]);
        const findEmployees = jest.fn().mockResolvedValue([
            {
                id: 42,
                firstName: 'Иван',
                lastName: 'Петров',
                departmentId: 1,
            },
        ]);
        const directoryRepo: DirectoryRepositoryPort = {
            findDepartments,
            findEmployees,
            updateEmployeesOrder: () => Promise.resolve(),
            findServiceAccountEmployeeIds: () =>
                Promise.resolve(new Set<number>()),
            setServiceAccount: () => Promise.resolve(null),
        };

        const service = new GetMotivationSchemaService(
            motivationSchemaRepo,
            directoryRepo,
        );

        return { service, findById, findDepartments, findEmployees };
    };

    it('выбрасывает NotFoundException, если схема не найдена', async () => {
        await withRequestContext(async () => {
            const { service } = buildService(null);

            await expect(service.execute('missing-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    it('выбрасывает NotFoundException, если у схемы 0 правил направления service', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Employee', 42, 0);
            const { service } = buildService(schema);

            await expect(service.execute(schema.id)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    it('резолвит target.name сотрудника и отдаёт правила схемы', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Employee', 42, 1);
            const { service } = buildService(schema);

            const result = await service.execute(schema.id);

            expect(result.id).toBe(schema.id);
            expect(result.direction).toBe('service');
            expect(result.target).toEqual({
                type: 'Employee',
                id: 42,
                name: 'Иван Петров',
            });
            expect(result.rules).toHaveLength(1);
            expect(result.rules[0]).toMatchObject({
                type: 'PayPerHour',
                name: 'Часы 0',
                targetRole: 'ENGINEER',
                config: { price: 100 },
            });
        });
    });

    it('резолвит target.name отдела через справочник', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Department', 1, 1);
            const { service } = buildService(schema);

            const result = await service.execute(schema.id);

            expect(result.target).toEqual({
                type: 'Department',
                id: 1,
                name: 'Сервисный отдел',
            });
        });
    });

    it('подставляет фоллбек-имя для targetId, не найденного в справочнике', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Employee', 999, 1);
            const { service } = buildService(schema);

            const result = await service.execute(schema.id);

            expect(result.target.name).toBe('Неизвестно (id: 999)');
        });
    });
});
