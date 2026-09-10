import { FindSalaryAccrualForTaskService } from './find-salary-accrual-for-task.service';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { ShopSalaryAccrualLine } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual-line.entity';

// Раздел 17 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../find-salary-accrual-for-task.service.spec.ts, без
// параметра direction (порт shop его не принимает). spec:
// shop/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
describe('FindSalaryAccrualForTaskService (shop)', () => {
    const buildLine = () =>
        ShopSalaryAccrualLine.fromBreakdownLine(
            {
                ruleId: 'rule-1',
                type: 'TaskCompletion',
                name: 'Собрать отчёт',
                targetRole: 'OFFLINE_MANAGER',
                amount: 5000,
                sources: [{ type: 'taskCompletion', id: 'task-1' }],
            },
            0,
        );

    const buildService = (line: ShopSalaryAccrualLine | null) => {
        const findLineByTaskId = jest.fn().mockResolvedValue(line);
        const salaryAccrualRepo = {
            findLineByTaskId,
        } as unknown as ShopSalaryAccrualRepositoryPort;
        return {
            service: new FindSalaryAccrualForTaskService(salaryAccrualRepo),
            findLineByTaskId,
        };
    };

    it('маппит найденную строку в ShopSalaryAccrualLineSummary', async () => {
        const line = buildLine();
        const { service, findLineByTaskId } = buildService(line);

        const summary = await service.execute('task-1');

        expect(findLineByTaskId).toHaveBeenCalledWith('task-1');
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
