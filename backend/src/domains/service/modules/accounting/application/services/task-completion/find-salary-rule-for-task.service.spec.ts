import { FindSalaryRuleForTaskService } from './find-salary-rule-for-task.service';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { TaskCompletion } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity';

// Раздел 17 tasks.md (add-task-salary-rule-links-comments) — оркестрация
// SalaryRuleRepositoryPort.findByTaskId для блока на карточке задачи
// (tasks/salary-rule-panel). spec:
// service/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
describe('FindSalaryRuleForTaskService', () => {
    const buildRule = () =>
        TaskCompletion.create({
            type: 'TaskCompletion',
            name: 'Собрать отчёт',
            targetRole: 'ENGINEER',
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
        } as unknown as SalaryRuleRepositoryPort;
        return {
            service: new FindSalaryRuleForTaskService(salaryRuleRepo),
            findByTaskId,
        };
    };

    it('маппит найденное правило в SalaryRuleSummary', async () => {
        const rule = buildRule();
        const { service, findByTaskId } = buildService(rule);

        const summary = await service.execute('task-1');

        expect(findByTaskId).toHaveBeenCalledWith('task-1');
        expect(summary).toEqual({
            id: rule.id,
            type: 'TaskCompletion',
            name: 'Собрать отчёт',
            targetRole: 'ENGINEER',
        });
    });

    it('возвращает null, если правило не найдено', async () => {
        const { service } = buildService(null);

        const summary = await service.execute('task-unknown');

        expect(summary).toBeNull();
    });
});
