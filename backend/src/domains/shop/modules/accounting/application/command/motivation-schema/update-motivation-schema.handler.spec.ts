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
import type { CancelTaskForRuleDeletionService } from '@/modules/tasks/application/services/cancel-task-for-rule-deletion.service';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Зеркало domains/service/modules/accounting/application/command/
// update-motivation-schema.handler.spec.ts (issue #57) — независимая копия
// для направления shop.
//
// openspec/changes/replace-bitrix-task-integration, design.md решение 3/5 —
// закрытие задачи Bitrix24 (closeTask) заменено на
// CancelTaskForRuleDeletionService.cancel(taskId) (src/modules/tasks) для
// КАЖДОГО taskId из config.taskIdByPeriod удаляемого TaskCompletion-правила
// (разовое правило — одна запись, регулярное — по одной на период).
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
            cancelImpl?: (taskId: string) => Promise<void>;
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

        const cancel = jest
            .fn()
            .mockImplementation(
                overrides?.cancelImpl ?? (() => Promise.resolve()),
            );
        const cancelTaskForRuleDeletion = {
            cancel,
        } as unknown as CancelTaskForRuleDeletionService;

        const handler = new UpdateShopMotivationSchemaHandler(
            shopMotivationSchemaRepo as ShopMotivationSchemaRepositoryPort,
            shopSalaryRuleRepo as ShopSalaryRuleRepositoryPort,
            unitOfWork,
            commandBus,
            cancelTaskForRuleDeletion,
        );

        return {
            handler,
            findById,
            update,
            deleteByIds,
            updateRule,
            run,
            execute,
            cancel,
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

    // openspec/changes/replace-bitrix-task-integration, design.md решение
    // 3/5 — при исключении правила TaskCompletion из пересобираемого
    // списка КАЖДЫЙ taskId из его config.taskIdByPeriod отменяется через
    // CancelTaskForRuleDeletionService.cancel() ДО удаления записи правила;
    // сама CancelTaskForRuleDeletionService уже no-op на терминальной
    // задаче (покрыто её собственным тестом, src/modules/tasks) — здесь
    // проверяем только то, что хендлер её действительно вызывает по
    // каждому taskId удаляемых правил.
    describe('правило TaskCompletion в старом наборе', () => {
        // ShopSalaryRule — плоский duck-typed интерфейс (см. domain/types/
        // salary-rule.types.ts) — фейковый объект с заданным config
        // достаточен для этого хендлера (он лишь читает
        // rule.config.taskIdByPeriod и передаёт rule дальше в
        // TaskCompletionShop.restore() как существующую карту), реальный
        // класс/восстановление через фабрику не обязательны и только
        // усложнили бы контроль над содержимым taskIdByPeriod в тесте.
        const buildSchemaWithTaskRule = (
            taskIdByPeriod: Record<string, string> = { '2026-08': 'task-9' },
        ) => {
            const taskRule: ShopSalaryRule = {
                id: 'task-rule-1',
                name: 'Сдать отчёт',
                type: 'TaskCompletion',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    taskIdByPeriod,
                    taskTitleTemplate: 'Сдать отчёт по браку',
                    isRecurring: true,
                    deadlineTemplate: '2026-08-05',
                    defaultAmount: 5000,
                },
                updatedAt: new Date('2026-08-01T00:00:00.000Z'),
                calculate: () => null,
            };
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

        it('отменяет все задачи (по каждому taskId taskIdByPeriod) удаляемого правила ДО удаления записи', async () => {
            await withRequestContext(async () => {
                const { schema, taskRule } = buildSchemaWithTaskRule({
                    '2026-07': 'task-7',
                    '2026-08': 'task-8',
                });
                const calls: string[] = [];
                const { handler, cancel, deleteByIds } = buildHandler(schema, {
                    cancelImpl: (taskId) => {
                        calls.push(`cancel:${taskId}`);
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

                expect(cancel).toHaveBeenCalledWith('task-7');
                expect(cancel).toHaveBeenCalledWith('task-8');
                expect(deleteByIds).toHaveBeenCalledWith([taskRule.id]);
                expect(calls).toEqual([
                    'cancel:task-7',
                    'cancel:task-8',
                    'deleteByIds',
                ]);
            });
        });

        it('схема без правил TaskCompletion — cancel вовсе не вызывается (регрессия)', async () => {
            await withRequestContext(async () => {
                const existingSchema = buildExistingSchema();
                const { handler, cancel } = buildHandler(existingSchema);
                const command = new UpdateShopMotivationSchemaCommand({
                    motivationSchemaId: 'schema-id',
                    name: 'Новое название',
                    rules: [],
                });

                await handler.execute(command);

                expect(cancel).not.toHaveBeenCalled();
            });
        });

        // Регрессия бага: правка TaskCompletion-правила (id сохранился в
        // payload) не должна отменять привязанные задачи — только PATCH,
        // реально исключающий правило из набора, отменяет их (см. тест
        // выше). taskIdByPeriod прежних периодов СОХРАНЯЕТСЯ (не
        // перезаписывается целиком) — TaskCompletionShop.restore() сливает
        // новый taskId (текущего периода, из тела запроса) с уже
        // существующей картой, а не заменяет её.
        it('правило TaskCompletion сохранилось в новом наборе (тот же id) — задачи НЕ отменяются, прежние записи taskIdByPeriod сохраняются', async () => {
            await withRequestContext(async () => {
                const { schema, taskRule } = buildSchemaWithTaskRule({
                    '2026-08': 'task-8',
                });
                const { handler, cancel, deleteByIds, updateRule, execute } =
                    buildHandler(schema);
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
                                taskId: 'task-9',
                                taskTitleTemplate: 'Сдать отчёт по браку',
                                isRecurring: true,
                                deadlineTemplate: '2026-08-05',
                                defaultAmount: 6000,
                            },
                        },
                    ],
                });

                await handler.execute(command);

                expect(cancel).not.toHaveBeenCalled();
                expect(deleteByIds).toHaveBeenCalledWith([]);
                expect(execute).not.toHaveBeenCalled();
                expect(updateRule).toHaveBeenCalledTimes(1);
                const [entity] = updateRule.mock.calls[0] as [
                    TaskCompletionShop,
                ];
                expect(entity.id).toBe(taskRule.id);
                expect(entity.name).toBe('Сдать отчёт (правка)');
                // Старая запись сохранена; новая (текущий период) добавлена
                // поверх неё — restore() сливает, а не заменяет карту.
                expect(entity.config.taskIdByPeriod['2026-08']).toBe('task-8');
                expect(Object.values(entity.config.taskIdByPeriod)).toContain(
                    'task-9',
                );
            });
        });
    });
});
