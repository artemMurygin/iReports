import { ListShopMotivationSchemasService } from './list-motivation-schemas.service';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import type { ShopMotivationTarget } from '@/domains/shop/modules/accounting/domain/value-objects/motivation-target.value-object';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';

// Зеркало domains/service/modules/accounting/application/services/
// list-motivation-schemas.service.spec.ts (Фаза "Редактирование зарплатных
// схем", issue #57) — независимая копия для направления shop.
describe('ListShopMotivationSchemasService', () => {
    const buildSchema = (
        id: string,
        targetId: number,
        rulesCount: number,
    ): ShopMotivationSchema => {
        const rules = Array.from({ length: rulesCount }, (_, index) =>
            ShopSalaryRuleFactory.create({
                type: 'PayPerHour',
                name: `Часы ${index}`,
                targetRole: 'ONLINE_MANAGER',
                config: { price: 100 },
            }),
        );
        return new ShopMotivationSchema({
            id,
            props: {
                target: {
                    getType: () => 'Employee',
                    getId: () => targetId,
                } as unknown as ShopMotivationTarget,
                name: `Схема ${id}`,
                rules,
            },
        });
    };

    const buildService = (
        schemas: ShopMotivationSchema[],
        options?: { serviceAccountIds?: number[] },
    ) => {
        const findAll = jest
            .fn<Promise<ShopMotivationSchema[]>, [any]>()
            .mockResolvedValue(schemas);
        const shopMotivationSchemaRepo: Partial<ShopMotivationSchemaRepositoryPort> =
            { findAll };

        const findDepartments = jest.fn().mockResolvedValue([]);
        const findEmployees = jest.fn().mockResolvedValue([
            {
                id: 1,
                firstName: 'Иван',
                lastName: 'Иванов',
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

        const service = new ListShopMotivationSchemasService(
            shopMotivationSchemaRepo as ShopMotivationSchemaRepositoryPort,
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

    it('отбрасывает схемы с 0 правилами направления shop', async () => {
        const schemas = [
            buildSchema('with-rules', 1, 1),
            buildSchema('without-rules', 2, 0),
        ];
        const { service } = buildService(schemas);

        const result = await service.execute({});

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('with-rules');
    });

    it('возвращает пустой список без похода в справочник, если все схемы без правил shop', async () => {
        const schemas = [buildSchema('without-rules', 2, 0)];
        const { service, findDepartments, findEmployees } =
            buildService(schemas);

        const result = await service.execute({});

        expect(result).toEqual([]);
        expect(findDepartments).not.toHaveBeenCalled();
        expect(findEmployees).not.toHaveBeenCalled();
    });

    // docs/employee-ordering-and-salary-filter, Фаза 3 — зеркало
    // list-motivation-schemas.service.spec.ts (domains/service), см. WHY
    // там.
    it('исключает схему, заведённую на сотрудника с isServiceAccount: true', async () => {
        const schemas = [buildSchema('with-rules', 1, 1)];
        const { service } = buildService(schemas, {
            serviceAccountIds: [1],
        });

        const result = await service.execute({});

        expect(result).toEqual([]);
    });

    it('резолвит имя цели из справочника сотрудников', async () => {
        const schemas = [buildSchema('with-rules', 1, 1)];
        const { service } = buildService(schemas);

        const result = await service.execute({});

        expect(result[0].target).toEqual({
            type: 'Employee',
            id: 1,
            name: 'Иван Иванов',
        });
    });

    it('фоллбек-имя, если targetId не найден в справочнике', async () => {
        const schemas = [buildSchema('with-rules', 999, 1)];
        const { service } = buildService(schemas);

        const result = await service.execute({});

        expect(result[0].target.name).toBe('Неизвестно (id: 999)');
    });

    it('передаёт фильтры query в findAll', async () => {
        const { service, findAll } = buildService([]);

        await service.execute({
            targetType: 'Employee',
            targetId: 1,
            search: 'оклад',
        });

        expect(findAll).toHaveBeenCalledWith({
            targetType: 'Employee',
            targetId: 1,
            search: 'оклад',
        });
    });

    it('direction всегда shop', async () => {
        const schemas = [buildSchema('with-rules', 1, 1)];
        const { service } = buildService(schemas);

        const result = await service.execute({});

        expect(result[0].direction).toBe('shop');
    });
});
