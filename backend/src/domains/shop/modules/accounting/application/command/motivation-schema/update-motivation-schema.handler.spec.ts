import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { UpdateShopMotivationSchemaHandler } from './update-motivation-schema.handler';
import { UpdateShopMotivationSchemaCommand } from './update-motivation-schema.command';
import { CreateShopSalaryRuleCommand } from './create-salary-rule.command';
import type { ShopMotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import type { ShopMotivationTarget } from '@/domains/shop/modules/accounting/domain/value-objects/motivation-target.value-object';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';
import { NotFoundException } from '@/shared/exceptions';

// Зеркало domains/service/modules/accounting/application/command/
// update-motivation-schema.handler.spec.ts (Фаза "Редактирование
// зарплатных схем", issue #57) — независимая копия для направления shop.
describe('UpdateShopMotivationSchemaHandler', () => {
    const buildExistingSchema = (rulesCount = 1): ShopMotivationSchema => {
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
                    getType: () => 'Employee',
                    getId: () => 1,
                } as unknown as ShopMotivationTarget,
                name: 'Старое название',
                rules,
            },
        });
    };

    const buildHandler = (existingSchema: ShopMotivationSchema | null) => {
        const findById = jest
            .fn<Promise<ShopMotivationSchema | null>, [string]>()
            .mockResolvedValue(existingSchema);
        const update = jest
            .fn<Promise<void>, [ShopMotivationSchema]>()
            .mockResolvedValue(undefined);
        const shopMotivationSchemaRepo: Partial<ShopMotivationSchemaRepositoryPort> =
            {
                findById,
                update,
            };

        const deleteAllByMotivationSchema = jest
            .fn<Promise<void>, [string]>()
            .mockResolvedValue(undefined);
        const shopSalaryRuleRepo: Partial<ShopSalaryRuleRepositoryPort> = {
            deleteAllByMotivationSchema,
        };

        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };

        const execute = jest
            .fn<Promise<unknown>, [CreateShopSalaryRuleCommand]>()
            .mockResolvedValue({ id: 'rule-id' });
        const commandBus = { execute } as unknown as CommandBus;

        const handler = new UpdateShopMotivationSchemaHandler(
            shopMotivationSchemaRepo as ShopMotivationSchemaRepositoryPort,
            shopSalaryRuleRepo as ShopSalaryRuleRepositoryPort,
            unitOfWork,
            commandBus,
        );

        return {
            handler,
            findById,
            update,
            deleteAllByMotivationSchema,
            run,
            execute,
        };
    };

    it('оборачивает переименование+удаление+пересоздание в unitOfWork.run', async () => {
        await withRequestContext(async () => {
            const { handler, run } = buildHandler(buildExistingSchema());
            const command = new UpdateShopMotivationSchemaCommand({
                motivationSchemaId: 'schema-id',
                name: 'Новое название',
                rules: [],
            });

            await handler.execute(command);

            expect(run).toHaveBeenCalledTimes(1);
        });
    });

    it('переименовывает схему и персистит через update()', async () => {
        await withRequestContext(async () => {
            const schema = buildExistingSchema();
            const { handler, update } = buildHandler(schema);
            const command = new UpdateShopMotivationSchemaCommand({
                motivationSchemaId: 'schema-id',
                name: 'Новое название',
                rules: [],
            });

            await handler.execute(command);

            expect(schema.getProps().name).toBe('Новое название');
            expect(update).toHaveBeenCalledTimes(1);
            expect(update.mock.calls[0][0]).toBe(schema);
        });
    });

    it('удаляет все правила направления shop схемы перед пересозданием', async () => {
        await withRequestContext(async () => {
            const schema = buildExistingSchema();
            const { handler, deleteAllByMotivationSchema, execute } =
                buildHandler(schema);
            const command = new UpdateShopMotivationSchemaCommand({
                motivationSchemaId: 'schema-id',
                name: 'Новое название',
                rules: [
                    {
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ONLINE_MANAGER',
                        config: { price: 150 },
                    },
                ],
            });

            const callOrder: string[] = [];
            deleteAllByMotivationSchema.mockImplementation(() => {
                callOrder.push('delete');
                return Promise.resolve();
            });
            execute.mockImplementation(() => {
                callOrder.push('create');
                return Promise.resolve({ id: 'rule-id' });
            });

            await handler.execute(command);

            expect(deleteAllByMotivationSchema).toHaveBeenCalledWith(
                'schema-id',
            );
            expect(callOrder).toEqual(['delete', 'create']);
        });
    });

    it('диспатчит CreateShopSalaryRuleCommand для каждого правила из payload', async () => {
        await withRequestContext(async () => {
            const schema = buildExistingSchema();
            const { handler, execute } = buildHandler(schema);
            const rules = [
                {
                    type: 'PayPerHour' as const,
                    name: 'Часы',
                    targetRole: 'ONLINE_MANAGER' as const,
                    config: { price: 150 },
                },
                {
                    type: 'ProductSold' as const,
                    name: 'Продажи',
                    targetRole: 'ONLINE_MANAGER' as const,
                    config: {
                        category: null,
                        award: { type: 'Fixed' as const, price: 200 },
                    },
                },
            ];
            const command = new UpdateShopMotivationSchemaCommand({
                motivationSchemaId: 'schema-id',
                name: 'Новое название',
                rules,
            });

            await handler.execute(command);

            expect(execute).toHaveBeenCalledTimes(2);
            for (const [dispatched] of execute.mock.calls) {
                expect(dispatched).toBeInstanceOf(CreateShopSalaryRuleCommand);
                expect(dispatched.motivationSchemaId).toBe('schema-id');
            }
            expect(execute.mock.calls[0][0].rule).toEqual(rules[0]);
            expect(execute.mock.calls[1][0].rule).toEqual(rules[1]);
        });
    });

    it('возвращает id обновлённой схемы', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler(buildExistingSchema());
            const command = new UpdateShopMotivationSchemaCommand({
                motivationSchemaId: 'schema-id',
                name: 'Новое название',
                rules: [],
            });

            const result = await handler.execute(command);

            expect(result.id).toBe('schema-id');
        });
    });

    it('бросает NotFoundException, если схема не найдена', async () => {
        await withRequestContext(async () => {
            const { handler, update, deleteAllByMotivationSchema } =
                buildHandler(null);
            const command = new UpdateShopMotivationSchemaCommand({
                motivationSchemaId: 'missing-id',
                name: 'Новое название',
                rules: [],
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                NotFoundException,
            );
            expect(update).not.toHaveBeenCalled();
            expect(deleteAllByMotivationSchema).not.toHaveBeenCalled();
        });
    });

    it('бросает NotFoundException, если у схемы 0 правил направления shop', async () => {
        await withRequestContext(async () => {
            const schema = buildExistingSchema(0);
            const { handler, update } = buildHandler(schema);
            const command = new UpdateShopMotivationSchemaCommand({
                motivationSchemaId: 'schema-id',
                name: 'Новое название',
                rules: [],
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                NotFoundException,
            );
            expect(update).not.toHaveBeenCalled();
        });
    });
});
