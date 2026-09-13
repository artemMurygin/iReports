import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeleteSalaryRuleHandler } from './delete-salary-rule.handler';
import { DeleteSalaryRuleCommand } from './delete-salary-rule.command';
import { DeleteTaskCommand } from '@/modules/tasks/application/command/delete-task/delete-task.command';
import { SalaryRuleNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-rule.exception';
import type { SalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { CancelTaskForRuleDeletionService } from '@/modules/tasks/application/services/cancel-task-for-rule-deletion.service';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { Period } from '@/shared/domain/period.value-object';

// add-task-rule-task-lifecycle — правило TaskCompletion не может
// существовать без своей задачи: удаление правила через эту команду ДОЛЖНО
// сразу же (без отдельного «Сохранить схему») убрать и правило, и его
// задачу(и) — иначе персистентное правило остаётся ссылаться на уже
// удалённую задачу.
describe('DeleteSalaryRuleHandler', () => {
    const CURRENT_PERIOD = Period.current().getValue();

    const buildTaskCompletionRule = (
        taskIdByPeriod: Record<string, string>,
    ): SalaryRule => ({
        id: 'rule-1',
        name: 'Обновить фото витрины',
        type: 'TaskCompletion',
        targetRole: 'ENGINEER',
        config: {
            taskIdByPeriod,
            taskTitleTemplate: 'Обновить фото витрины',
            taskLinkTemplates: [],
            isRecurring: Object.keys(taskIdByPeriod).length > 1,
            deadlineTemplate: '',
            defaultAmount: 5000,
        },
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        isActive: true,
        calculate: () => null,
        deactivate: () => {},
        activate: () => {},
    });

    const buildHandler = (rule: SalaryRule | null) => {
        const deleteByIds = jest
            .fn<Promise<void>, [string[]]>()
            .mockResolvedValue(undefined);
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteByIds,
            findById: jest.fn().mockResolvedValue(rule),
            update: jest.fn(),
            findByTaskId: jest.fn().mockResolvedValue(null),
            findMotivationSchemaId: jest.fn().mockResolvedValue(null),
        };

        const run = jest.fn((work: () => Promise<unknown>) => work());
        const unitOfWork: UnitOfWorkPort = {
            run: run as UnitOfWorkPort['run'],
        };

        const execute = jest
            .fn<Promise<unknown>, [DeleteTaskCommand]>()
            .mockResolvedValue(undefined);
        const commandBus = { execute } as unknown as CommandBus;

        const cancel = jest
            .fn<Promise<void>, [string]>()
            .mockResolvedValue(undefined);
        const cancelTaskForRuleDeletion = {
            cancel,
        } as unknown as CancelTaskForRuleDeletionService;

        const handler = new DeleteSalaryRuleHandler(
            salaryRuleRepo,
            unitOfWork,
            commandBus,
            cancelTaskForRuleDeletion,
        );

        return { handler, deleteByIds, run, execute, cancel };
    };

    it('удаляет правило и безвозвратно удаляет задачу текущего периода', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskCompletionRule({
                [CURRENT_PERIOD]: 'task-current',
            });
            const { handler, deleteByIds, execute, cancel } =
                buildHandler(rule);

            await handler.execute(
                new DeleteSalaryRuleCommand({ ruleId: 'rule-1' }),
            );

            expect(deleteByIds).toHaveBeenCalledWith(['rule-1']);
            expect(execute).toHaveBeenCalledWith(
                expect.objectContaining({ taskId: 'task-current' }),
            );
            expect(cancel).not.toHaveBeenCalled();
        });
    });

    it('мягко отменяет задачи прошлых периодов регулярного правила, не удаляя их', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskCompletionRule({
                '2026-08': 'task-past',
                [CURRENT_PERIOD]: 'task-current',
            });
            const { handler, execute, cancel } = buildHandler(rule);

            await handler.execute(
                new DeleteSalaryRuleCommand({ ruleId: 'rule-1' }),
            );

            expect(cancel).toHaveBeenCalledWith('task-past');
            expect(execute).toHaveBeenCalledTimes(1);
            expect(execute).toHaveBeenCalledWith(
                expect.objectContaining({ taskId: 'task-current' }),
            );
        });
    });

    it('удаляет правило БЕЗ задачи для не-TaskCompletion типа', async () => {
        await withRequestContext(async () => {
            const rule: SalaryRule = {
                id: 'rule-2',
                name: 'Часы',
                type: 'PayPerHour',
                targetRole: 'ENGINEER',
                config: { price: 100 },
                updatedAt: new Date(),
                isActive: true,
                calculate: () => null,
                deactivate: () => {},
                activate: () => {},
            };
            const { handler, deleteByIds, execute, cancel } =
                buildHandler(rule);

            await handler.execute(
                new DeleteSalaryRuleCommand({ ruleId: 'rule-2' }),
            );

            expect(deleteByIds).toHaveBeenCalledWith(['rule-2']);
            expect(execute).not.toHaveBeenCalled();
            expect(cancel).not.toHaveBeenCalled();
        });
    });

    it('бросает SalaryRuleNotFoundException и ничего не удаляет для несуществующего правила', async () => {
        await withRequestContext(async () => {
            const { handler, deleteByIds } = buildHandler(null);

            await expect(
                handler.execute(
                    new DeleteSalaryRuleCommand({ ruleId: 'missing' }),
                ),
            ).rejects.toThrow(SalaryRuleNotFoundException);
            expect(deleteByIds).not.toHaveBeenCalled();
        });
    });
});
