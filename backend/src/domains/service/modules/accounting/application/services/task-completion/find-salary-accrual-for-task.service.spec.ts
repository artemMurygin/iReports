import { FindSalaryAccrualForTaskService } from './find-salary-accrual-for-task.service';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { SalaryAccrualLine } from '@/domains/service/modules/accounting/domain/entities/salary-accrual/salary-accrual-line.entity';

// Раздел 17 tasks.md (add-task-salary-rule-links-comments) — оркестрация
// SalaryAccrualRepositoryPort.findLineByTaskId для блока на карточке
// задачи. direction фиксирован 'service' (сервис этого домена всегда ищет
// в своих документах). spec:
// service/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
describe('FindSalaryAccrualForTaskService', () => {
    const buildLine = () =>
        SalaryAccrualLine.fromBreakdownLine(
            {
                ruleId: 'rule-1',
                type: 'TaskCompletion',
                name: 'Собрать отчёт',
                targetRole: 'ENGINEER',
                amount: 5000,
                sources: [{ type: 'taskCompletion', id: 'task-1' }],
            },
            0,
        );

    const buildService = (line: SalaryAccrualLine | null) => {
        const findLineByTaskId = jest.fn().mockResolvedValue(line);
        const salaryAccrualRepo = {
            findLineByTaskId,
        } as unknown as SalaryAccrualRepositoryPort;
        return {
            service: new FindSalaryAccrualForTaskService(salaryAccrualRepo),
            findLineByTaskId,
        };
    };

    it('маппит найденную строку в SalaryAccrualLineSummary', async () => {
        const line = buildLine();
        const { service, findLineByTaskId } = buildService(line);

        const summary = await service.execute('task-1');

        expect(findLineByTaskId).toHaveBeenCalledWith('service', 'task-1');
        expect(summary).toEqual({
            id: line.id,
            amount: 5000,
            status: 'DRAFT',
        });
    });

    it('возвращает null, если начисление ещё не отображается', async () => {
        const { service } = buildService(null);

        const summary = await service.execute('task-unknown');

        expect(summary).toBeNull();
    });
});
