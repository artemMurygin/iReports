import { withRequestContext } from '@/shared/testing/with-request-context';
import { ListMotivationSchemasService } from './list-motivation-schemas.service';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ServiceCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/service-completed.entity';

describe('ListMotivationSchemasService', () => {
    const buildSchema = (
        targetType: 'Department' | 'Employee',
        targetId: number,
        name: string,
        ruleCount: number,
    ) => {
        const rules = Array.from({ length: ruleCount }, (_, index) =>
            index % 2 === 0
                ? PayPerHoursEntity.create({
                      type: 'PayPerHour',
                      name: `Часы ${index}`,
                      targetRole: 'ENGINEER',
                      config: { price: 100 },
                  })
                : ServiceCompletedEntity.create({
                      type: 'ServiceCompleted',
                      name: `Услуги ${index}`,
                      targetRole: 'ENGINEER',
                      config: { award: { type: 'ServiceFixed' } },
                  }),
        );

        return MotivationSchema.create({
            targetType,
            targetId,
            name,
            rules,
        });
    };

    const buildService = (
        schemas: MotivationSchema[],
        options?: { serviceAccountIds?: number[] },
    ) => {
        const findAll = jest
            .fn<Promise<MotivationSchema[]>, [unknown]>()
            .mockResolvedValue(schemas);
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: jest.fn(),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
            findAll,
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
        const findServiceAccountEmployeeIds = jest
            .fn()
            .mockResolvedValue(new Set(options?.serviceAccountIds ?? []));
        const directoryRepo: DirectoryRepositoryPort = {
            findDepartments,
            findEmployees,
            updateEmployeesOrder: () => Promise.resolve(),
            findServiceAccountEmployeeIds,
            setServiceAccount: () => Promise.resolve(null),
        };

        const service = new ListMotivationSchemasService(
            motivationSchemaRepo,
            directoryRepo,
        );

        return {
            service,
            findAll,
            findDepartments,
            findEmployees,
            findServiceAccountEmployeeIds,
        };
    };

    it('отбрасывает схемы с 0 правилами направления service (rules уже отфильтрованы репозиторием)', async () => {
        await withRequestContext(async () => {
            const withoutRules = buildSchema('Employee', 42, 'Пустая', 0);
            const withRules = buildSchema('Employee', 42, 'Оклад', 1);
            const { service } = buildService([withoutRules, withRules]);

            const result = await service.execute({});

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(withRules.id);
        });
    });

    it('не обращается в справочник, если все схемы отфильтрованы', async () => {
        await withRequestContext(async () => {
            const withoutRules = buildSchema('Employee', 42, 'Пустая', 0);
            const { service, findDepartments, findEmployees } = buildService([
                withoutRules,
            ]);

            const result = await service.execute({});

            expect(result).toEqual([]);
            expect(findDepartments).not.toHaveBeenCalled();
            expect(findEmployees).not.toHaveBeenCalled();
        });
    });

    // docs/employee-ordering-and-salary-filter, Фаза 3, "не попадают ... в
    // списки": схема, заведённая на служебный аккаунт, отсутствует в ответе
    // целиком — не с заглушкой имени (в отличие от подлинно отсутствующего
    // в Bitrix24 сотрудника, см. тест "подставляет фоллбек-имя" ниже).
    it('исключает схему, заведённую на сотрудника с isServiceAccount: true', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Employee', 42, 'Служебный оклад', 1);
            const { service } = buildService([schema], {
                serviceAccountIds: [42],
            });

            const result = await service.execute({});

            expect(result).toEqual([]);
        });
    });

    it('не исключает схему отдела, даже если её id совпадает с id служебного сотрудника', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Department', 42, 'Оклад отдела', 1);
            const { service } = buildService([schema], {
                serviceAccountIds: [42],
            });

            const result = await service.execute({});

            expect(result).toHaveLength(1);
        });
    });

    it('резолвит target.name сотрудника через справочник', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Employee', 42, 'Оклад', 1);
            const { service } = buildService([schema]);

            const [item] = await service.execute({});

            expect(item.target).toEqual({
                type: 'Employee',
                id: 42,
                name: 'Иван Петров',
            });
        });
    });

    it('резолвит target.name отдела через справочник', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Department', 1, 'Оклад отдела', 1);
            const { service } = buildService([schema]);

            const [item] = await service.execute({});

            expect(item.target).toEqual({
                type: 'Department',
                id: 1,
                name: 'Сервисный отдел',
            });
        });
    });

    it('подставляет фоллбек-имя для targetId, не найденного в справочнике', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Employee', 999, 'Оклад', 1);
            const { service } = buildService([schema]);

            const [item] = await service.execute({});

            expect(item.target.name).toBe('Неизвестно (id: 999)');
        });
    });

    it('считает ruleCount и уникальные ruleTypes в порядке первого появления', async () => {
        await withRequestContext(async () => {
            const schema = buildSchema('Employee', 42, 'Оклад', 3);
            const { service } = buildService([schema]);

            const [item] = await service.execute({});

            expect(item.ruleCount).toBe(3);
            expect(item.ruleTypes).toEqual(['PayPerHour', 'ServiceCompleted']);
        });
    });

    it('передаёт query-фильтры в findAll репозитория как есть', async () => {
        await withRequestContext(async () => {
            const { service, findAll } = buildService([]);

            await service.execute({
                targetType: 'Employee',
                targetId: 42,
                search: 'оклад',
            });

            expect(findAll).toHaveBeenCalledWith({
                targetType: 'Employee',
                targetId: 42,
                search: 'оклад',
            });
        });
    });
});
