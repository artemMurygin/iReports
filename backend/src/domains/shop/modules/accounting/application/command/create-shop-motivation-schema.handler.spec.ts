import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateShopMotivationSchemaHandler } from './create-shop-motivation-schema.handler';
import { CreateShopMotivationSchemaCommand } from './create-shop-motivation-schema.command';
import { CreateShopSalaryRuleCommand } from './create-shop-salary-rule.command';
import type { ShopMotivationSchemaRepositoryPort } from '../ports/shop-motivation-schema.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';

// Зеркало domains/service/modules/accounting/application/command/
// create-motivation-schema.handler.spec.ts (Фаза 13.5, issue #57) —
// независимая копия для направления shop.
describe('CreateShopMotivationSchemaHandler', () => {
    const buildHandler = (existingId: string | null = null) => {
        const insert = jest
            .fn<Promise<void>, [ShopMotivationSchema]>()
            .mockResolvedValue(undefined);
        const findIdByTarget = jest
            .fn<Promise<string | null>, [string, number]>()
            .mockResolvedValue(existingId);
        const findByEmployee = jest
            .fn<Promise<ShopMotivationSchema | null>, [number]>()
            .mockResolvedValue(null);
        const findAllEmployeeTargets = jest
            .fn<Promise<ShopMotivationSchema[]>, []>()
            .mockResolvedValue([]);
        const findByEmployees = jest
            .fn<Promise<ShopMotivationSchema[]>, [number[]]>()
            .mockResolvedValue([]);
        const shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
            insert,
            findByEmployee,
            findAllEmployeeTargets,
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees,
            findIdByTarget,
            findById: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue(undefined),
        };
        // run() выполняет переданную работу напрямую, без реальной транзакции —
        // для юнит-теста хендлера этого достаточно, транзакционность самого
        // UnitOfWork проверяется отдельно на уровне его реализации.
        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };
        const execute = jest
            .fn<Promise<unknown>, [CreateShopSalaryRuleCommand]>()
            .mockResolvedValue({ id: 'rule-id' });
        const commandBus = { execute } as unknown as CommandBus;

        const handler = new CreateShopMotivationSchemaHandler(
            shopMotivationSchemaRepo,
            unitOfWork,
            commandBus,
        );

        return { handler, insert, findIdByTarget, run, execute };
    };

    it('оборачивает запись схемы и правил в unitOfWork.run', async () => {
        await withRequestContext(async () => {
            const { handler, run } = buildHandler();
            const command = new CreateShopMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [],
            });

            await handler.execute(command);

            expect(run).toHaveBeenCalledTimes(1);
        });
    });

    it('сохраняет созданную ShopMotivationSchema через репозиторий', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateShopMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [],
            });

            await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            const [insertedEntity] = insert.mock.calls[0];
            expect(insertedEntity).toBeInstanceOf(ShopMotivationSchema);
            const insertedProps = insertedEntity.getProps();
            expect(insertedProps.target.getType()).toBe('Employee');
            expect(insertedProps.target.getId()).toBe(1);
            expect(insertedProps.name).toBe('Оклад');
        });
    });

    it('диспатчит CreateShopSalaryRuleCommand для каждого правила с id созданной схемы', async () => {
        await withRequestContext(async () => {
            const { handler, execute } = buildHandler();
            const command = new CreateShopMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [
                    {
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ONLINE_MANAGER',
                        config: { price: 100 },
                    },
                    {
                        type: 'ProductSold',
                        name: 'Продажи',
                        targetRole: 'ONLINE_MANAGER',
                        config: {
                            category: null,
                            award: { type: 'Fixed', price: 100 },
                        },
                    },
                ],
            });

            const result = await handler.execute(command);

            expect(execute).toHaveBeenCalledTimes(2);
            for (const [dispatched] of execute.mock.calls) {
                expect(dispatched).toBeInstanceOf(CreateShopSalaryRuleCommand);
                expect(dispatched.motivationSchemaId).toBe(result.id);
            }
            expect(execute.mock.calls[0][0].rule).toEqual(command.rules[0]);
        });
    });

    it('возвращает id созданной схемы', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler();
            const command = new CreateShopMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [],
            });

            const result = await handler.execute(command);

            expect(result.id).toEqual(expect.any(String));
        });
    });

    it('если findIdByTarget нашёл существующую схему — не вставляет новую, а дописывает правила к найденному id', async () => {
        await withRequestContext(async () => {
            const { handler, insert, execute } =
                buildHandler('existing-schema-id');
            const command = new CreateShopMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 1,
                name: 'Оклад',
                rules: [
                    {
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ONLINE_MANAGER',
                        config: { price: 100 },
                    },
                    {
                        type: 'ProductSold',
                        name: 'Продажи',
                        targetRole: 'ONLINE_MANAGER',
                        config: {
                            category: null,
                            award: { type: 'Fixed', price: 100 },
                        },
                    },
                ],
            });

            const result = await handler.execute(command);

            expect(insert).not.toHaveBeenCalled();
            expect(result.id).toBe('existing-schema-id');
            expect(execute).toHaveBeenCalledTimes(2);
            for (const [dispatched] of execute.mock.calls) {
                expect(dispatched).toBeInstanceOf(CreateShopSalaryRuleCommand);
                expect(dispatched.motivationSchemaId).toBe(
                    'existing-schema-id',
                );
            }
        });
    });

    it('вызывает findIdByTarget с targetType/targetId команды', async () => {
        await withRequestContext(async () => {
            const { handler, findIdByTarget } = buildHandler();
            const command = new CreateShopMotivationSchemaCommand({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад',
                rules: [],
            });

            await handler.execute(command);

            expect(findIdByTarget).toHaveBeenCalledWith('Employee', 42);
        });
    });
});
