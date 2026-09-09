import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { UpdateMotivationSchemaHandler } from './update-motivation-schema.handler';
import { UpdateMotivationSchemaCommand } from './update-motivation-schema.command';
import { CreateSalaryRuleCommand } from './create-salary-rule.command';
import { NotFoundException } from '@/shared/exceptions';
import type { MotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import type { SalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import type { BitrixTasksGatewayPort } from '@/integrations/bitrix/ports/bitrix-tasks-gateway.port';
import type { SalaryTaskRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

describe('UpdateMotivationSchemaHandler', () => {
    const buildExistingSchema = (ruleCount = 1) => {
        const rules = Array.from({ length: ruleCount }, (_, index) =>
            PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: `Часы ${index}`,
                targetRole: 'ENGINEER',
                config: { price: 100 },
            }),
        );

        return MotivationSchema.create({
            targetType: 'Employee',
            targetId: 1,
            name: 'Старое имя',
            rules,
        });
    };

    const buildHandler = (
        existingSchema: MotivationSchema | null,
        overrides?: {
            closeTaskImpl?: () => Promise<void>;
            findActiveByRuleImpl?: (ruleId: string) => Promise<SalaryTask[]>;
        },
    ) => {
        const findById = jest
            .fn<Promise<MotivationSchema | null>, [string]>()
            .mockResolvedValue(existingSchema);
        const update = jest
            .fn<Promise<void>, [MotivationSchema]>()
            .mockResolvedValue(undefined);
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
            update,
            initializeName: jest.fn().mockResolvedValue(undefined),
        };
        const deleteByIds = jest
            .fn<Promise<void>, [string[]]>()
            .mockResolvedValue(undefined);
        const updateRule = jest
            .fn<Promise<void>, [SalaryRule]>()
            .mockResolvedValue(undefined);
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds,
            findById: jest.fn().mockResolvedValue(null),
            update: updateRule,
        };
        // run() выполняет переданную работу напрямую, без реальной транзакции
        // — тот же приём, что и в create-motivation-schema.handler.spec.ts.
        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };
        const execute = jest
            .fn<Promise<unknown>, [CreateSalaryRuleCommand]>()
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
        const salaryTaskRepo: SalaryTaskRepositoryPort = {
            findByRuleAndPeriod: jest.fn(),
            findActiveForDirection: jest.fn(),
            insert: jest.fn(),
            save: jest.fn(),
            findManyByRulesAndPeriod: jest.fn().mockResolvedValue([]),
            findActiveByRule,
        };

        const handler = new UpdateMotivationSchemaHandler(
            motivationSchemaRepo,
            salaryRuleRepo,
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

    it('оборачивает переименование и замену правил в unitOfWork.run', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler, run } = buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            await handler.execute(command);

            expect(run).toHaveBeenCalledTimes(1);
        });
    });

    it('переименовывает найденную схему и персистит имя через update', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler, update } = buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            await handler.execute(command);

            expect(existingSchema.getProps().name).toBe('Новое имя');
            expect(update).toHaveBeenCalledTimes(1);
            expect(update.mock.calls[0][0]).toBe(existingSchema);
        });
    });

    it('удаляет правила, отсутствующие в новом наборе (diff по id)', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const oldRuleId = existingSchema.getProps().rules[0].id;
            const { handler, deleteByIds } = buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            await handler.execute(command);

            expect(deleteByIds).toHaveBeenCalledTimes(1);
            expect(deleteByIds).toHaveBeenCalledWith([oldRuleId]);
        });
    });

    it('правило из payload с id существующего правила — обновляется на месте, не удаляется и не пересоздаётся', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const oldRuleId = existingSchema.getProps().rules[0].id;
            const { handler, deleteByIds, updateRule, execute } =
                buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [
                    {
                        id: oldRuleId,
                        type: 'PayPerHour',
                        name: 'Часы (отредактировано)',
                        targetRole: 'ENGINEER',
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
            expect(entity.config).toEqual({ price: 250 });
        });
    });

    it('id совпадает со старым правилом, но тип изменился — старое удаляется, новое создаётся (не update)', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const oldRuleId = existingSchema.getProps().rules[0].id;
            const { handler, deleteByIds, updateRule, execute } =
                buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [
                    {
                        id: oldRuleId,
                        type: 'ServiceCompleted',
                        name: 'Услуги вместо часов',
                        targetRole: 'ENGINEER',
                        config: { award: { type: 'ServiceFixed' } },
                    },
                ],
            });

            await handler.execute(command);

            expect(deleteByIds).toHaveBeenCalledWith([oldRuleId]);
            expect(updateRule).not.toHaveBeenCalled();
            expect(execute).toHaveBeenCalledTimes(1);
        });
    });

    it('id в payload, не найденный среди старых правил, — создаёт новое правило (не update)', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler, updateRule, execute } =
                buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [
                    {
                        id: 'unknown-rule-id',
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ENGINEER',
                        config: { price: 250 },
                    },
                ],
            });

            await handler.execute(command);

            expect(updateRule).not.toHaveBeenCalled();
            expect(execute).toHaveBeenCalledTimes(1);
        });
    });

    it('диспатчит CreateSalaryRuleCommand для каждого правила из payload с id схемы', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler, execute } = buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [
                    {
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ENGINEER',
                        config: { price: 150 },
                    },
                    {
                        type: 'ServiceCompleted',
                        name: 'Услуги',
                        targetRole: 'ENGINEER',
                        config: { award: { type: 'ServiceFixed' } },
                    },
                ],
            });

            const result = await handler.execute(command);

            expect(execute).toHaveBeenCalledTimes(2);
            for (const [dispatched] of execute.mock.calls) {
                expect(dispatched).toBeInstanceOf(CreateSalaryRuleCommand);
                expect(dispatched.motivationSchemaId).toBe(result.id);
            }
            expect(execute.mock.calls[0][0].rule).toEqual(command.rules[0]);
            expect(execute.mock.calls[1][0].rule).toEqual(command.rules[1]);
        });
    });

    it('возвращает id обновлённой схемы', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema();
            const { handler } = buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            const result = await handler.execute(command);

            expect(result.id).toBe(existingSchema.id);
        });
    });

    it('выбрасывает NotFoundException, если схема не найдена', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler(null);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: 'missing-id',
                name: 'Новое имя',
                rules: [],
            });

            await expect(handler.execute(command)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    // Раздел 12 tasks.md (add-task-based-salary-rule), design.md Decision 6 —
    // при исключении правила TaskCompletion из нового набора (diff по id —
    // rules: [] означает удаление всех старых правил) связанная задача
    // закрывается в Bitrix24 ДО удаления записи правила; сбой Bitrix24 не
    // блокирует удаление (внешняя система, расхождение обнаружит крон
    // синхронизации статуса, раздел 8).
    describe('правило TaskCompletion в старом наборе', () => {
        const buildSchemaWithTaskRule = () => {
            const taskRule = TaskCompletion.create({
                type: 'TaskCompletion',
                name: 'Сдать отчёт',
                targetRole: 'ENGINEER',
                config: {
                    bitrixTaskTitle: 'Сдать отчёт по браку',
                    isRecurring: true,
                    deadlineTemplate: '2026-08-05',
                    defaultAmount: 5000,
                },
            });
            const schema = MotivationSchema.create({
                targetType: 'Employee',
                targetId: 1,
                name: 'Старое имя',
                rules: [taskRule],
            });
            return { schema, taskRule };
        };

        it('закрывает связанную активную задачу Bitrix24 ДО удаления правил', async () => {
            await withRequestContext(async () => {
                const { schema, taskRule } = buildSchemaWithTaskRule();
                const activeTask = SalaryTask.create({
                    salaryRuleId: taskRule.id,
                    period: '2026-08',
                    deadline: new Date('2026-08-05T00:00:00.000Z'),
                    isRecurring: true,
                    bitrixTaskId: 'bx-9',
                    taskStatus: TaskStatus.fromRaw('2'),
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
                const command = new UpdateMotivationSchemaCommand({
                    motivationSchemaId: schema.id,
                    name: 'Новое имя',
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
                const activeTask = SalaryTask.create({
                    salaryRuleId: taskRule.id,
                    period: '2026-08',
                    deadline: new Date('2026-08-05T00:00:00.000Z'),
                    isRecurring: true,
                    bitrixTaskId: 'bx-9',
                    taskStatus: TaskStatus.fromRaw('2'),
                });
                const { handler, deleteByIds } = buildHandler(schema, {
                    findActiveByRuleImpl: () => Promise.resolve([activeTask]),
                    closeTaskImpl: () =>
                        Promise.reject(new Error('bitrix close down')),
                });
                const command = new UpdateMotivationSchemaCommand({
                    motivationSchemaId: schema.id,
                    name: 'Новое имя',
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
                const command = new UpdateMotivationSchemaCommand({
                    motivationSchemaId: existingSchema.id,
                    name: 'Новое имя',
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
                const command = new UpdateMotivationSchemaCommand({
                    motivationSchemaId: schema.id,
                    name: 'Новое имя',
                    rules: [
                        {
                            id: taskRule.id,
                            type: 'TaskCompletion',
                            name: 'Сдать отчёт (правка)',
                            targetRole: 'ENGINEER',
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

    it('выбрасывает NotFoundException, если у схемы 0 правил направления service (все правила — shop-стороны)', async () => {
        await withRequestContext(async () => {
            const existingSchema = buildExistingSchema(0);
            const { handler, update, deleteByIds } =
                buildHandler(existingSchema);
            const command = new UpdateMotivationSchemaCommand({
                motivationSchemaId: existingSchema.id,
                name: 'Новое имя',
                rules: [],
            });

            await expect(handler.execute(command)).rejects.toThrow(
                NotFoundException,
            );
            expect(update).not.toHaveBeenCalled();
            expect(deleteByIds).not.toHaveBeenCalled();
        });
    });
});
