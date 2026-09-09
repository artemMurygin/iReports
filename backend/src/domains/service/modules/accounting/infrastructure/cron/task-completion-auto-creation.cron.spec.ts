// logCronError пишет в файл на диске (см. cron-file-logger.ts) — мокаем,
// чтобы юнит-тест не оставлял побочных файлов в репозитории (тот же приём,
// что SalesPlanAutoCreationCron.spec.ts).
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { TaskCompletionAutoCreationCron } from './task-completion-auto-creation.cron';
import type { EnsureSalaryTaskForPeriodService } from '../../application/services/salary-task/ensure-salary-task-for-period.service';
import type { ResolveEmployeeSalaryRulesService } from '../../application/services/calculation/resolve-employee-salary-rules.service';
import { logCronError } from '@/shared/cron/cron-file-logger';

// Раздел 11 tasks.md (add-task-based-salary-rule) — по образцу
// SalesPlanAutoCreationCron.spec.ts: правило-задача обходится через уже
// существующий ResolveEmployeeSalaryRulesService.forAllTargets() (тот же
// источник, что использует закрытие периода для "все сотрудники со своими
// правилами"), а не через отдельное перечисление в SALARY_RULE_REPOSITORY.
describe('TaskCompletionAutoCreationCron', () => {
    const buildCron = (ensure: jest.Mock, forAllTargets: jest.Mock) =>
        new TaskCompletionAutoCreationCron(
            { ensure } as unknown as EnsureSalaryTaskForPeriodService,
            {
                forAllTargets,
            } as unknown as ResolveEmployeeSalaryRulesService,
        );

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('вызывает ensure() для каждого активного регулярного TaskCompletion-правила каждого сотрудника за текущий период (UTC)', async () => {
        jest.useFakeTimers().setSystemTime(
            new Date('2026-09-01T00:00:00.000Z'),
        );
        const ensure = jest.fn().mockResolvedValue(null);
        const forAllTargets = jest.fn().mockResolvedValue(
            new Map([
                [
                    1,
                    {
                        rules: [
                            {
                                id: 'rule-recurring',
                                type: 'TaskCompletion',
                                config: { isRecurring: true },
                            },
                            {
                                id: 'rule-oneoff',
                                type: 'TaskCompletion',
                                config: { isRecurring: false },
                            },
                            {
                                id: 'rule-other-type',
                                type: 'PayPerHour',
                                config: {},
                            },
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
            ]),
        );
        const cron = buildCron(ensure, forAllTargets);

        await cron.run();

        expect(ensure).toHaveBeenCalledTimes(1);
        expect(ensure).toHaveBeenCalledWith('rule-recurring', '2026-09', 1);
    });

    it('не выбрасывает исключение при ошибке — только логирует', async () => {
        const ensure = jest.fn();
        const forAllTargets = jest.fn().mockRejectedValue(new Error('db down'));
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
