import { FindSalaryRuleForTaskService } from './find-salary-rule-for-task.service';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { TaskCompletionShop } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/task-completion.entity';

// Раздел 17 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../find-salary-rule-for-task.service.spec.ts. spec:
// shop/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
describe('FindSalaryRuleForTaskService (shop)', () => {
    const buildRule = () =>
        TaskCompletionShop.create({
            type: 'TaskCompletion',
            name: 'Собрать отчёт',
            targetRole: 'OFFLINE_MANAGER',
            config: {
                taskId: 'task-1',
                taskTitleTemplate: 'Шаблон',
                isRecurring: false,
                deadlineTemplate: '2026-01-25',
                defaultAmount: 5000,
                accountingPeriod: '2026-01',
            },
        });

    const buildService = (rule: ReturnType<typeof buildRule> | null) => {
        const findByTaskId = jest.fn().mockResolvedValue(rule);
        const salaryRuleRepo = {
            findByTaskId,
        } as unknown as ShopSalaryRuleRepositoryPort;
        return {
            service: new FindSalaryRuleForTaskService(salaryRuleRepo),
            findByTaskId,
        };
    };

    it('маппит найденное правило в ShopSalaryRuleSummary', async () => {
        const rule = buildRule();
        const { service, findByTaskId } = buildService(rule);

        const summary = await service.execute('task-1');

        expect(findByTaskId).toHaveBeenCalledWith('task-1');
        expect(summary).toEqual({
            id: rule.id,
            type: 'TaskCompletion',
            name: 'Собрать отчёт',
            targetRole: 'OFFLINE_MANAGER',
        });
    });

    it('возвращает null, если правило не найдено', async () => {
        const { service } = buildService(null);

        const summary = await service.execute('task-unknown');

        expect(summary).toBeNull();
    });
});
