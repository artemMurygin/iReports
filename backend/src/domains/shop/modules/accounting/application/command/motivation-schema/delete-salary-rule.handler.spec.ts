import { CommandBus } from '@nestjs/cqrs';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeleteShopSalaryRuleHandler } from './delete-salary-rule.handler';
import { DeleteShopSalaryRuleCommand } from './delete-salary-rule.command';
import { DeleteTaskCommand } from '@/modules/tasks/application/command/delete-task/delete-task.command';
import { ShopSalaryRuleNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-rule.exception';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import type { CancelTaskForRuleDeletionService } from '@/modules/tasks/application/services/cancel-task-for-rule-deletion.service';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { Period } from '@/shared/domain/period.value-object';

// Зеркало domains/service/.../delete-salary-rule.handler.spec.ts —
// независимая копия для направления shop.
describe('DeleteShopSalaryRuleHandler', () => {
    const CURRENT_PERIOD = Period.current().getValue();

    const buildTaskCompletionRule = (
        taskIdByPeriod: Record<string, string>,
    ): ShopSalaryRule => ({
        id: 'rule-1',
        name: 'Обновить фото витрины',
        type: 'TaskCompletion',
        targetRole: 'ONLINE_MANAGER',
        config: {
            taskIdByPeriod,
            taskTitleTemplate: 'Обновить фото витрины',
            taskLinkTemplates: [],
            isRecurring: Object.keys(taskIdByPeriod).length > 1,
            deadlineTemplate: '',
            defaultAmount: 5000,
        },
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        calculate: () => null,
    });

    const buildHandler = (rule: ShopSalaryRule | null) => {
        const deleteByIds = jest
            .fn<Promise<void>, [string[]]>()
            .mockResolvedValue(undefined);
        const shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort = {
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

        const handler = new DeleteShopSalaryRuleHandler(
            shopSalaryRuleRepo,
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
                new DeleteShopSalaryRuleCommand({ ruleId: 'rule-1' }),
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
                new DeleteShopSalaryRuleCommand({ ruleId: 'rule-1' }),
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
            const rule: ShopSalaryRule = {
                id: 'rule-2',
                name: 'Процент от выручки',
                type: 'ProductSold',
                targetRole: 'ONLINE_MANAGER',
                config: { award: { type: 'ServicePercent', percent: 5 } },
                updatedAt: new Date(),
                calculate: () => null,
            } as unknown as ShopSalaryRule;
            const { handler, deleteByIds, execute, cancel } =
                buildHandler(rule);

            await handler.execute(
                new DeleteShopSalaryRuleCommand({ ruleId: 'rule-2' }),
            );

            expect(deleteByIds).toHaveBeenCalledWith(['rule-2']);
            expect(execute).not.toHaveBeenCalled();
            expect(cancel).not.toHaveBeenCalled();
        });
    });

    it('бросает ShopSalaryRuleNotFoundException и ничего не удаляет для несуществующего правила', async () => {
        await withRequestContext(async () => {
            const { handler, deleteByIds } = buildHandler(null);

            await expect(
                handler.execute(
                    new DeleteShopSalaryRuleCommand({ ruleId: 'missing' }),
                ),
            ).rejects.toThrow(ShopSalaryRuleNotFoundException);
            expect(deleteByIds).not.toHaveBeenCalled();
        });
    });
});
