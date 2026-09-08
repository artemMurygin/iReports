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
import { TaskCompletionShop } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import type { ShopSalaryTaskRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-task/salary-task.port';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { ShopTaskStatus } from '@/domains/shop/modules/accounting/domain/value-objects/task-status.value-object';
import { Period } from '@/shared/domain/period.value-object';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

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

    const buildHandler = (
        existingSchema: ShopMotivationSchema | null,
        overrides?: {
            closeTaskImpl?: () => Promise<void>;
            findActiveByRuleImpl?: (
                ruleId: string,
            ) => Promise<ShopSalaryTask[]>;
        },
    ) => {
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

        const deleteByIds = jest
            .fn<Promise<void>, [string[]]>()
            .mockResolvedValue(undefined);
        const updateRule = jest
            .fn<Promise<void>, [ShopSalaryRule]>()
            .mockResolvedValue(undefined);
        const shopSalaryRuleRepo: Partial<ShopSalaryRuleRepositoryPort> = {
            deleteByIds,
            update: updateRule,
        };

        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };

        const execute = jest
            .fn<Promise<unknown>, [CreateShopSalaryRuleCommand]>()
            .mockResolvedValue({ id: 'rule-id' });
        const commandBus = { execute } as unknown as CommandBus;

        const closeTask = jest
            .fn()
            .mockImplementation(
                overrides?.closeTaskImpl ?? (() => Promise.resolve()),
            );
        const tasksGateway: BitrixTasksGatewayPort = {
            createTask: jest.fn(),
            closeTask,
            updateDeadline: jest.fn(),
        };

        const findActiveByRule = jest
            .fn()
            .mockImplementation(
                overrides?.findActiveByRuleImpl ?? (() => Promise.resolve([])),
            );
        const salaryTaskRepo: ShopSalaryTaskRepositoryPort = {
            findByRuleAndPeriod: jest.fn(),
            findActiveForDirection: jest.fn(),
            insert: jest.fn(),
            save: jest.fn(),
            findManyByRulesAndPeriod: jest.fn().mockResolvedValue([]),
            findActiveByRule,
        };

        const handler = new UpdateShopMotivationSchemaHandler(
            shopMotivationSchemaRepo as ShopMotivationSchemaRepositoryPort,
            shopSalaryRuleRepo as ShopSalaryRuleRepositoryPort,
            unitOfWork,
            commandBus,
            tasksGateway,
            salaryTaskRepo,
        );

        return {
            handler,
            findById,
            update,
            deleteByIds,
            updateRule,
            run,
            execute,
            closeTask,
            findActiveByRule,
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

    it('удаляет правила, отсутствующие в новом наборе (diff по id), и создаёт новые', async () => {
        await withRequestContext(async () => {
            const schema = buildExistingSchema();
            const oldRuleId = schema.getProps().rules[0].id;
            const { handler, deleteByIds, execute } = buildHandler(schema);
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
            deleteByIds.mockImplementation(() => {
                callOrder.push('delete');
                return Promise.resolve();
            });
            execute.mockImplementation(() => {
                callOrder.push('create');
                return Promise.resolve({ id: 'rule-id' });
            });

            await handler.execute(command);

            expect(deleteByIds).toHaveBeenCalledWith([oldRuleId]);
            expect(callOrder).toEqual(['delete', 'create']);
        });
    });

    it('правило из payload с id существующего правила — обновляется на месте, не удаляется и не пересоздаётся', async () => {
        await withRequestContext(async () => {
            const schema = buildExistingSchema();
            const oldRuleId = schema.getProps().rules[0].id;
            const { handler, deleteByIds, updateRule, execute } =
                buildHandler(schema);
            const command = new UpdateShopMotivationSchemaCommand({
                motivationSchemaId: 'schema-id',
                name: 'Новое название',
                rules: [
                    {
                        id: oldRuleId,
                        type: 'PayPerHour',
                        name: 'Часы (отредактировано)',
                        targetRole: 'ONLINE_MANAGER',
                        config: { price: 250 },
                    },
                ],
            });

            await handler.execute(command);

            expect(deleteByIds).toHaveBeenCalledWith([]);
            expect(execute).not.toHaveBeenCalled();
            expect(updateRule).toHaveBeenCalledTimes(1);
            const [entity] = updateRule.mock.calls[0];
            expect(entity.id).toBe(oldRuleId);
            expect(entity.name).toBe('Часы (отредактировано)');
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
            const { handler, update, deleteByIds } = buildHandler(null);
            const command = new UpdateShopMotivationSchemaCommand({
                motivationSchemaId: 'missing-id',
                name: 'Новое название',
                rules: [],
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                NotFoundException,
            );
            expect(update).not.toHaveBeenCalled();
            expect(deleteByIds).not.toHaveBeenCalled();
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

    // Раздел 17 tasks.md (add-task-based-salary-rule), design.md Decision 6 —
    // зеркало UpdateMotivationSchemaHandler направления service (раздел 12,
    // issue #57 — независимая копия): при исключении правила TaskCompletion
    // из пересобираемого списка связанная задача закрывается в Bitrix24 ДО
    // удаления записи правила; сбой Bitrix24 не блокирует удаление
    // (внешняя система, расхождение обнаруживает крон синхронизации
    // статуса, раздел 8).
    describe('правило TaskCompletion в старом наборе', () => {
        const buildSchemaWithTaskRule = () => {
            const taskRule = TaskCompletionShop.create({
                type: 'TaskCompletion',
                name: 'Сдать отчёт',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    bitrixTaskTitle: 'Сдать отчёт по браку',
                    isRecurring: true,
                    deadlineTemplate: '2026-08-05',
                    defaultAmount: 5000,
                },
            });
            const schema = new ShopMotivationSchema({
                id: 'schema-id',
                props: {
                    target: {
                        getType: () => 'Employee',
                        getId: () => 1,
                        isEmployee: () => true,
                    } as unknown as ShopMotivationTarget,
                    name: 'Старое название',
                    rules: [taskRule],
                },
            });
            return { schema, taskRule };
        };

        it('закрывает связанную активную задачу Bitrix24 ДО удаления правил', async () => {
            await withRequestContext(async () => {
                const { schema, taskRule } = buildSchemaWithTaskRule();
                const activeTask = ShopSalaryTask.create({
                    salaryRuleId: taskRule.id,
                    period: Period.create('2026-08'),
                    deadline: new Date('2026-08-05T00:00:00.000Z'),
                    isRecurring: true,
                    bitrixTaskId: 'bx-9',
                    taskStatus: ShopTaskStatus.fromRaw('2'),
                });
                const calls: string[] = [];
                const { handler, closeTask, findActiveByRule, deleteByIds } =
                    buildHandler(schema, {
                        findActiveByRuleImpl: (ruleId) => {
                            expect(ruleId).toBe(taskRule.id);
                            return Promise.resolve([activeTask]);
                        },
                        closeTaskImpl: () => {
                            calls.push('closeTask');
                            return Promise.resolve();
                        },
                    });
                deleteByIds.mockImplementation(() => {
                    calls.push('deleteByIds');
                    return Promise.resolve();
                });
                const command = new UpdateShopMotivationSchemaCommand({
                    motivationSchemaId: schema.id,
                    name: 'Новое название',
                    rules: [],
                });

                await handler.execute(command);

                expect(findActiveByRule).toHaveBeenCalledWith(taskRule.id);
                expect(closeTask).toHaveBeenCalledWith('bx-9');
                expect(deleteByIds).toHaveBeenCalledWith([taskRule.id]);
                expect(calls).toEqual(['closeTask', 'deleteByIds']);
            });
        });

        it('ошибка closeTask НЕ блокирует удаление правила — только логируется', async () => {
            await withRequestContext(async () => {
                const { schema, taskRule } = buildSchemaWithTaskRule();
                const activeTask = ShopSalaryTask.create({
                    salaryRuleId: taskRule.id,
                    period: Period.create('2026-08'),
                    deadline: new Date('2026-08-05T00:00:00.000Z'),
                    isRecurring: true,
                    bitrixTaskId: 'bx-9',
                    taskStatus: ShopTaskStatus.fromRaw('2'),
                });
                const { handler, deleteByIds } = buildHandler(schema, {
                    findActiveByRuleImpl: () => Promise.resolve([activeTask]),
                    closeTaskImpl: () =>
                        Promise.reject(new Error('bitrix close down')),
                });
                const command = new UpdateShopMotivationSchemaCommand({
                    motivationSchemaId: schema.id,
                    name: 'Новое название',
                    rules: [],
                });

                await expect(handler.execute(command)).resolves.toEqual({
                    id: schema.id,
                });

                expect(deleteByIds).toHaveBeenCalledTimes(1);
            });
        });

        it('схема без правил TaskCompletion — closeTask вовсе не вызывается (регрессия)', async () => {
            await withRequestContext(async () => {
                const existingSchema = buildExistingSchema();
                const { handler, closeTask, findActiveByRule } =
                    buildHandler(existingSchema);
                const command = new UpdateShopMotivationSchemaCommand({
                    motivationSchemaId: 'schema-id',
                    name: 'Новое название',
                    rules: [],
                });

                await handler.execute(command);

                expect(findActiveByRule).not.toHaveBeenCalled();
                expect(closeTask).not.toHaveBeenCalled();
            });
        });

        // Регрессия бага: правка TaskCompletion-правила (id сохранился в
        // payload) не должна закрывать/пересоздавать привязанную задачу
        // Bitrix24 — только PATCH, реально исключающий правило из набора,
        // закрывает задачу (см. тест выше).
        it('правило TaskCompletion сохранилось в новом наборе (тот же id) — задача Bitrix24 НЕ закрывается и правило не пересоздаётся', async () => {
            await withRequestContext(async () => {
                const { schema, taskRule } = buildSchemaWithTaskRule();
                const {
                    handler,
                    closeTask,
                    findActiveByRule,
                    deleteByIds,
                    updateRule,
                    execute,
                } = buildHandler(schema);
                const command = new UpdateShopMotivationSchemaCommand({
                    motivationSchemaId: schema.id,
                    name: 'Новое название',
                    rules: [
                        {
                            id: taskRule.id,
                            type: 'TaskCompletion',
                            name: 'Сдать отчёт (правка)',
                            targetRole: 'ONLINE_MANAGER',
                            config: {
                                bitrixTaskTitle: 'Сдать отчёт по браку',
                                isRecurring: true,
                                deadlineTemplate: '2026-08-05',
                                defaultAmount: 6000,
                            },
                        },
                    ],
                });

                await handler.execute(command);

                expect(findActiveByRule).not.toHaveBeenCalled();
                expect(closeTask).not.toHaveBeenCalled();
                expect(deleteByIds).toHaveBeenCalledWith([]);
                expect(execute).not.toHaveBeenCalled();
                expect(updateRule).toHaveBeenCalledTimes(1);
                const [entity] = updateRule.mock.calls[0];
                expect(entity.id).toBe(taskRule.id);
                expect(entity.name).toBe('Сдать отчёт (правка)');
            });
        });
    });
});
