// logCronError пишет в файл на диске (см. cron-file-logger.ts) — мокаем,
// чтобы юнит-тест не оставлял побочных файлов в репозитории.
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { TaskCompletionAutoCreationCron } from './task-completion-auto-creation.cron';
import type { EnsureRuleTaskForPeriodService } from '@/domains/service/modules/accounting/application/services/task-completion/ensure-rule-task-for-period.service';
import type { ResolvedEmployeeSalaryRules } from '@/domains/service/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { logCronError } from '@/shared/cron/cron-file-logger';

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
        expect(logCronError).toHaveBeenCalledWith(
            'TaskCompletionAutoCreationCron.run',
            expect.any(Error),
            expect.objectContaining<{ period: string }>({
                period: expect.any(String) as string,
            }),
        );
    });
});
