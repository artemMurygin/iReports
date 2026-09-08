import { withRequestContext } from '@/shared/testing/with-request-context';
import { CommandBus } from '@nestjs/cqrs';
import {
    EnsureRuleTaskForPeriodService,
    computeDeadlineForPeriod,
    filterRecurringTaskCompletionRules,
} from './ensure-rule-task-for-period.service';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { CreateTaskCommand } from '@/modules/tasks/application/command/create-task/create-task.command';
import { ArgumentInvalidException } from '@/shared/exceptions';

// replace-bitrix-task-integration, design.md решение 4, Migration Plan шаг 3
// — заменяет прежний EnsureSalaryTaskForPeriodService (Bitrix-based):
// idempotency по-прежнему по config.taskIdByPeriod[period], но создание
// новой задачи идёт через общий CommandBus (CreateTaskCommand, тот же
// публичный use-case, что и HTTP POST /v1/tasks) вместо
// BitrixTasksGatewayPort, а результат сохраняется локальным update(rule) —
// без похода в отдельный репозиторий SalaryTask/Bitrix.
describe('EnsureRuleTaskForPeriodService', () => {
    const buildRule = (overrides?: {
        isRecurring?: boolean;
        deadlineTemplate?: string;
        taskIdByPeriod?: Record<string, string>;
    }) =>
        withRequestContext(
            () =>
                new TaskCompletion({
                    id: 'rule-1',
                    props: {
                        name: 'Собрать отчёт по браку',
                        type: 'TaskCompletion',
                        targetRole: 'ENGINEER',
                        config: {
                            taskIdByPeriod: overrides?.taskIdByPeriod ?? {},
                            taskTitleTemplate:
                                'Собрать отчёт по браку за месяц',
                            taskDescriptionTemplate:
                                'Свериться с журналом брака',
                            isRecurring: overrides?.isRecurring ?? true,
                            deadlineTemplate:
                                overrides?.deadlineTemplate ?? '2026-01-15',
                            defaultAmount: 5000,
                        },
                    },
                }),
        );

    const buildService = () => {
        const update = jest.fn().mockResolvedValue(undefined);
        const ruleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds: jest.fn(),
            findById: jest.fn(),
            update,
        };
        const execute = jest.fn().mockResolvedValue({ id: 'new-task-id' });
        const commandBus = { execute } as unknown as CommandBus;
        const service = new EnsureRuleTaskForPeriodService(
            ruleRepo,
            commandBus,
        );
        return { service, update, execute };
    };

    it('идемпотентность: возвращает уже существующий taskId периода без обращения в CommandBus', async () => {
        await withRequestContext(async () => {
            const rule = buildRule({
                taskIdByPeriod: { '2026-09': 'existing-task' },
            });
            const { service, update, execute } = buildService();

            const result = await service.ensure(rule, '2026-09', 555);

            expect(result).toBe('existing-task');
            expect(execute).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('разовое правило без задачи за запрошенный период — возвращает null, не создаёт задачу', async () => {
        await withRequestContext(async () => {
            const rule = buildRule({ isRecurring: false });
            const { service, update, execute } = buildService();

            const result = await service.ensure(rule, '2026-10', 555);

            expect(result).toBeNull();
            expect(execute).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('регулярное правило: диспатчит CreateTaskCommand с дедлайном нового периода и сохраняет taskId в config.taskIdByPeriod через update(rule)', async () => {
        await withRequestContext(async () => {
            const rule = buildRule({
                isRecurring: true,
                deadlineTemplate: '2026-01-15',
            });
            const { service, update, execute } = buildService();

            const result = await service.ensure(rule, '2026-09', 555);

            expect(execute).toHaveBeenCalledWith(expect.any(CreateTaskCommand));
            const [command] = execute.mock.calls[0] as [CreateTaskCommand];
            expect(command.title).toBe('Собрать отчёт по браку за месяц');
            expect(command.description).toBe('Свериться с журналом брака');
            expect(command.deadline).toEqual(
                new Date('2026-09-15T00:00:00.000Z'),
            );
            expect(command.assigneeEmployeeId).toBe(555);
            expect(command.direction).toBe('service');

            expect(result).toBe('new-task-id');
            expect(rule.config.taskIdByPeriod['2026-09']).toBe('new-task-id');
            expect(update).toHaveBeenCalledWith(rule);
        });
    });

    it('регулярное правило: день дедлайна зажимается длиной короткого месяца (28/29 февраля)', async () => {
        await withRequestContext(async () => {
            const rule = buildRule({
                isRecurring: true,
                deadlineTemplate: '2026-01-31',
            });
            const { service, execute } = buildService();

            await service.ensure(rule, '2026-02', 555);

            const [command] = execute.mock.calls[0] as [CreateTaskCommand];
            expect(command.deadline).toEqual(
                new Date('2026-02-28T00:00:00.000Z'),
            );
        });
    });

    it('бросает ArgumentInvalidException для правила другого типа', async () => {
        await withRequestContext(async () => {
            const other = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                config: { price: 100 },
            });
            const { service } = buildService();

            await expect(service.ensure(other, '2026-09', 555)).rejects.toThrow(
                ArgumentInvalidException,
            );
        });
    });
});

describe('computeDeadlineForPeriod', () => {
    it('строит дедлайн периода из числа месяца шаблона', () => {
        expect(computeDeadlineForPeriod('2026-01-15', '2026-09')).toEqual(
            new Date('2026-09-15T00:00:00.000Z'),
        );
    });

    it('зажимает день длиной целевого месяца', () => {
        expect(computeDeadlineForPeriod('2026-01-31', '2026-02')).toEqual(
            new Date('2026-02-28T00:00:00.000Z'),
        );
    });
});

describe('filterRecurringTaskCompletionRules', () => {
    it('возвращает только регулярные TaskCompletion-правила', () => {
        const recurring = withRequestContext(() =>
            TaskCompletion.create({
                type: 'TaskCompletion',
                name: 'Регулярное',
                targetRole: 'ENGINEER',
                config: {
                    taskId: 't1',
                    taskTitleTemplate: 'т',
                    isRecurring: true,
                    deadlineTemplate: '2026-01-15',
                    defaultAmount: 1,
                },
            }),
        );
        const oneOff = withRequestContext(() =>
            TaskCompletion.create({
                type: 'TaskCompletion',
                name: 'Разовое',
                targetRole: 'ENGINEER',
                config: {
                    taskId: 't2',
                    taskTitleTemplate: 'т',
                    isRecurring: false,
                    deadlineTemplate: '2026-01-15',
                    defaultAmount: 1,
                },
            }),
        );
        const other = PayPerHoursEntity.create({
            type: 'PayPerHour',
            name: 'Часы',
            targetRole: 'ENGINEER',
            config: { price: 100 },
        });

        expect(
            filterRecurringTaskCompletionRules([recurring, oneOff, other]),
        ).toEqual([recurring]);
    });
});
