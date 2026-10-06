import { Logger } from '@nestjs/common';
import { TaskCompletionAutoCreationCron } from './task-completion-auto-creation.cron';
import type { EnsureRuleTaskForPeriodService } from '@/domains/service/modules/accounting/application/services/task-completion/ensure-rule-task-for-period.service';
import type { ResolvedEmployeeSalaryRules } from '@/domains/service/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

function recurringTaskCompletionRule(id: string): SalaryRule {
    return {
        id,
        type: 'TaskCompletion',
        config: { isRecurring: true },
    } as unknown as SalaryRule;
}

function oneTimeTaskCompletionRule(id: string): SalaryRule {
    return {
        id,
        type: 'TaskCompletion',
        config: { isRecurring: false },
    } as unknown as SalaryRule;
}

describe('TaskCompletionAutoCreationCron', () => {
    // Ошибки крона уходят в структурный logger.error — подслушиваем
    // прототип, т.к. Logger создаётся внутри самого крона.
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    const buildCron = (ensure: jest.Mock, forAllTargets: jest.Mock) =>
        new TaskCompletionAutoCreationCron(
            { ensure } as unknown as EnsureRuleTaskForPeriodService,
            {
                forAllTargets,
            } as unknown as ResolveEmployeeSalaryRulesService,
        );

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        errorSpy.mockRestore();
    });

    it('заводит задачу текущего периода (UTC) только для регулярных TaskCompletion-правил каждого сотрудника', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-10-01T10:00:00.000Z'),
        );
        const ensure = jest.fn().mockResolvedValue('task-1');
        const byEmployee = new Map<number, ResolvedEmployeeSalaryRules>([
            [
                1,
                {
                    rules: [
                        recurringTaskCompletionRule('rule-recurring'),
                        oneTimeTaskCompletionRule('rule-one-time'),
                    ],
                    schemasVersion: 'v1',
                },
            ],
            [
                2,
                {
                    rules: [],
                    schemasVersion: 'v1',
                },
            ],
        ]);
        const forAllTargets = jest.fn().mockResolvedValue(byEmployee);
        const cron = buildCron(ensure, forAllTargets);

        await cron.run();

        expect(forAllTargets).toHaveBeenCalledTimes(1);
        expect(ensure).toHaveBeenCalledTimes(1);
        expect(ensure).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'rule-recurring' }),
            '2026-10',
            1,
        );
    });

    it('не выбрасывает исключение при ошибке достраивания — только логирует', async () => {
        const forAllTargets = jest.fn().mockRejectedValue(new Error('db down'));
        const ensure = jest.fn();
        const cron = buildCron(ensure, forAllTargets);

        await expect(cron.run()).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                err: expect.any(Error) as Error,
                period: expect.any(String) as string,
            }),
            expect.any(String),
        );
    });
});
