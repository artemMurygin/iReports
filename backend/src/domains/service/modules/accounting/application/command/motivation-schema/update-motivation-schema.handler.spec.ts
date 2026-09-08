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
import type { CancelTaskForRuleDeletionService } from '@/modules/tasks/application/services/cancel-task-for-rule-deletion.service';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { Period } from '@/shared/domain/period.value-object';

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
            cancelImpl?: (taskId: string) => Promise<void>;
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

        const cancel = jest
            .fn<Promise<void>, [string]>()
            .mockImplementation(
                overrides?.cancelImpl ?? (() => Promise.resolve()),
            );
        const cancelTaskForRuleDeletion = {
            cancel,
        } as unknown as CancelTaskForRuleDeletionService;

        const handler = new UpdateMotivationSchemaHandler(
            motivationSchemaRepo,
            salaryRuleRepo,
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

    // replace-bitrix-task-integration, design.md решение 3 «Отмена при
    // удалении правила» — при исключении правила TaskCompletion из нового
    // набора (diff по id — rules: [] означает удаление всех старых правил)
    // связанные задачи (по ВСЕМ периодам config.taskIdByPeriod) отменяются
    // (CancelTaskForRuleDeletionService.cancel()) ДО удаления записи
    // правила; сбой отмены не блокирует удаление.
    describe('правило TaskCompletion в старом наборе', () => {
        const buildSchemaWithTaskRule = (
            taskIdByPeriod: Record<string, string> = { '2026-08': 'task-9' },
        ) => {
            const taskRule = new TaskCompletion({
                id: 'task-rule-1',
                props: {
                    name: 'Сдать отчёт',
                    type: 'TaskCompletion',
                    targetRole: 'ENGINEER',
                    config: {
                        taskIdByPeriod,
                        taskTitleTemplate: 'Сдать отчёт по браку',
                        isRecurring: true,
                        deadlineTemplate: '2026-08-05',
                        defaultAmount: 5000,
                    },
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

        it('отменяет связанную задачу ДО удаления правил', async () => {
            await withRequestContext(async () => {
                const { schema, taskRule } = buildSchemaWithTaskRule();
                const calls: string[] = [];
                const { handler, cancel, deleteByIds } = buildHandler(schema, {
                    cancelImpl: () => {
                        calls.push('cancel');
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

                expect(cancel).toHaveBeenCalledWith('task-9');
                expect(deleteByIds).toHaveBeenCalledWith([taskRule.id]);
                expect(calls).toEqual(['cancel', 'deleteByIds']);
            });
        });

        it('регулярное правило с несколькими периодами — отменяет ВСЕ задачи, не только последнего периода', async () => {
            await withRequestContext(async () => {
                const { schema } = buildSchemaWithTaskRule({
                    '2026-07': 'task-7',
                    '2026-08': 'task-8',
                });
                const { handler, cancel } = buildHandler(schema);
                const command = new UpdateMotivationSchemaCommand({
                    motivationSchemaId: schema.id,
                    name: 'Новое имя',
                    rules: [],
                });

                await handler.execute(command);

                expect(cancel).toHaveBeenCalledWith('task-7');
                expect(cancel).toHaveBeenCalledWith('task-8');
                expect(cancel).toHaveBeenCalledTimes(2);
            });
        });

        it('ошибка отмены НЕ блокирует удаление правила — только логируется', async () => {
            await withRequestContext(async () => {
                const { schema } = buildSchemaWithTaskRule();
                const { handler, deleteByIds } = buildHandler(schema, {
                    cancelImpl: () => Promise.reject(new Error('cancel down')),
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

        it('схема без правил TaskCompletion — cancel вовсе не вызывается (регрессия)', async () => {
            await withRequestContext(async () => {
                const existingSchema = buildExistingSchema();
                const { handler, cancel } = buildHandler(existingSchema);
                const command = new UpdateMotivationSchemaCommand({
                    motivationSchemaId: existingSchema.id,
                    name: 'Новое имя',
                    rules: [],
                });

                await handler.execute(command);

                expect(cancel).not.toHaveBeenCalled();
            });
        });

        // Регрессия бага: правка TaskCompletion-правила (id сохранился в
        // payload) не должна отменять/пересоздавать привязанную задачу —
        // только PATCH, реально исключающий правило из набора, отменяет
        // задачу (см. тест выше). Старая привязка (прошлые периоды)
        // сохраняется, текущий period.taskId запроса мержится поверх.
        it('правило TaskCompletion сохранилось в новом наборе (тот же id) — задача НЕ отменяется, taskIdByPeriod прошлых периодов сохраняется', async () => {
            await withRequestContext(async () => {
                const { schema, taskRule } = buildSchemaWithTaskRule({
                    '2026-07': 'task-old',
                });
                const { handler, cancel, deleteByIds, updateRule, execute } =
                    buildHandler(schema);
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
                                taskId: 'task-current',
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
                const [entity] = updateRule.mock.calls[0];
                expect(entity.id).toBe(taskRule.id);
                expect(entity.name).toBe('Сдать отчёт (правка)');
                expect(entity.config).toMatchObject({
                    taskIdByPeriod: {
                        '2026-07': 'task-old',
                        [Period.current().getValue()]: 'task-current',
                    },
                });
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
