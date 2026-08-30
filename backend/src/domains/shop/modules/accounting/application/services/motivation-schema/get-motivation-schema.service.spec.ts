import { GetShopMotivationSchemaService } from './get-motivation-schema.service';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import type { ShopMotivationTarget } from '@/domains/shop/modules/accounting/domain/value-objects/motivation-target.value-object';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';
import { NotFoundException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Зеркало domains/service/modules/accounting/application/services/
// get-motivation-schema.service.spec.ts (Фаза "Редактирование зарплатных
// схем", issue #57) — независимая копия для направления shop.
describe('GetShopMotivationSchemaService', () => {
    const buildSchema = (
        rulesCount: number,
        targetType: 'Department' | 'Employee' = 'Employee',
        targetId = 1,
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
            id: 'schema-id',
            props: {
                target: {
                    getType: () => targetType,
                    getId: () => targetId,
                } as unknown as ShopMotivationTarget,
                name: 'Схема',
                rules,
            },
        });
    };

    const buildService = (schema: ShopMotivationSchema | null) => {
        const findById = jest
            .fn<Promise<ShopMotivationSchema | null>, [string]>()
            .mockResolvedValue(schema);
        const shopMotivationSchemaRepo: Partial<ShopMotivationSchemaRepositoryPort> =
            { findById };

        const findDepartments = jest
            .fn()
            .mockResolvedValue([{ id: 5, name: 'Продажи' }]);
        const findEmployees = jest.fn().mockResolvedValue([
            {
                id: 1,
                firstName: 'Иван',
                lastName: 'Иванов',
                departmentId: 1,
            },
        ]);
        const directoryRepo: DirectoryRepositoryPort = {
            findDepartments,
            findEmployees,
        };

        const service = new GetShopMotivationSchemaService(
            shopMotivationSchemaRepo as ShopMotivationSchemaRepositoryPort,
            directoryRepo,
        );

        return { service, findById, findDepartments, findEmployees };
    };

    it('бросает NotFoundException, если схема не найдена', async () => {
        await withRequestContext(async () => {
            const { service } = buildService(null);

            await expect(service.execute('missing-id')).rejects.toBeInstanceOf(
                NotFoundException,
            );
        });
    });

    it('бросает NotFoundException, если у схемы 0 правил направления shop', async () => {
        await withRequestContext(async () => {
            const { service } = buildService(buildSchema(0));

            await expect(service.execute('schema-id')).rejects.toBeInstanceOf(
                NotFoundException,
            );
        });
    });

    it('возвращает деталь схемы с резолвленным именем сотрудника', async () => {
        const { service } = buildService(buildSchema(1, 'Employee', 1));

        const result = await service.execute('schema-id');

        expect(result.id).toBe('schema-id');
        expect(result.direction).toBe('shop');
        expect(result.target).toEqual({
            type: 'Employee',
            id: 1,
            name: 'Иван Иванов',
        });
        expect(result.rules).toHaveLength(1);
    });

    it('возвращает деталь схемы с резолвленным именем отдела', async () => {
        const { service } = buildService(buildSchema(1, 'Department', 5));

        const result = await service.execute('schema-id');

        expect(result.target).toEqual({
            type: 'Department',
            id: 5,
            name: 'Продажи',
        });
    });

    it('фоллбек-имя, если targetId не найден в справочнике', async () => {
        const { service } = buildService(buildSchema(1, 'Employee', 999));

        const result = await service.execute('schema-id');

        expect(result.target.name).toBe('Неизвестно (id: 999)');
    });
});
