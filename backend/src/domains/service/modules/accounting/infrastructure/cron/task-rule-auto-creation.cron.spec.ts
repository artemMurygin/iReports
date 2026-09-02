// logCronError пишет в файл на диске (см. cron-file-logger.ts) — мокаем,
// чтобы юнит-тест не оставлял побочных файлов в репозитории (тот же приём,
// что и у sales-plan-auto-creation.cron.spec.ts).
jest.mock('@/shared/cron/cron-file-logger', () => ({
    logCronError: jest.fn(),
}));

import { withRequestContext } from '@/shared/testing/with-request-context';
import { TaskRuleAutoCreationCron } from './task-rule-auto-creation.cron';
import type { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import type { EnsureBitrixTaskForPeriodService } from '@/domains/service/modules/accounting/application/services/ensure-bitrix-task-for-period.service';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { logCronError } from '@/shared/cron/cron-file-logger';

describe('TaskRuleAutoCreationCron', () => {
    const buildTaskRule = (bitrixTaskIds: number[] = [1]) =>
        withRequestContext(() =>
            TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name: 'Ежемесячный отчёт',
                targetRole: 'ENGINEER',
                config: {
                    description: 'Описание',
                    period: '2026-08',
                    isRecurring: true,
                    dueDate: '2026-08-20',
                    rewardAmount: 1000,
                    bitrixTaskIds,
                },
            }),
        );

    const buildOtherRule = () =>
        withRequestContext(() =>
            PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Часы',
                targetRole: 'ENGINEER',
                config: { price: 100 },
            }),
        );

    const buildCron = (
        salaryRulesByEmployee: Map<number, { rules: SalaryRule[] }>,
        ensure: jest.Mock,
    ) => {
        const forAllTargets = jest
            .fn()
            .mockResolvedValue(salaryRulesByEmployee);
        const salaryRulesResolver = {
            forAllTargets,
        } as unknown as ResolveEmployeeSalaryRulesService;
        const ensureBitrixTask = {
            ensure,
        } as unknown as EnsureBitrixTaskForPeriodService;

        return {
            cron: new TaskRuleAutoCreationCron(
                salaryRulesResolver,
                ensureBitrixTask,
            ),
            forAllTargets,
        };
    };

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
    });

    it('вызывает ensure для каждого правила TaskCompleted, найденного среди всех сотрудников', async () => {
        await withRequestContext(async () => {
            jest.useFakeTimers().setSystemTime(
                new Date('2026-09-01T00:00:00.000Z'),
            );
            const taskRule1 = buildTaskRule([1]);
            const taskRule2 = buildTaskRule([2]);
            const otherRule = buildOtherRule();
            const ensure = jest.fn().mockResolvedValue(undefined);
            const { cron } = buildCron(
                new Map([
                    [10, { rules: [taskRule1, otherRule] }],
                    [20, { rules: [taskRule2] }],
                ]),
                ensure,
            );

            await cron.run();

            expect(ensure).toHaveBeenCalledTimes(2);
            expect(ensure).toHaveBeenCalledWith(taskRule1, '2026-09', 10);
            expect(ensure).toHaveBeenCalledWith(taskRule2, '2026-09', 20);
        });
    });

    it('не выбрасывает исключение, если резолвинг правил падает — только логирует', async () => {
        await withRequestContext(async () => {
            const forAllTargets = jest
                .fn()
                .mockRejectedValue(new Error('db down'));
            const salaryRulesResolver = {
                forAllTargets,
            } as unknown as ResolveEmployeeSalaryRulesService;
            const ensureBitrixTask = {
                ensure: jest.fn(),
            } as unknown as EnsureBitrixTaskForPeriodService;
            const cron = new TaskRuleAutoCreationCron(
                salaryRulesResolver,
                ensureBitrixTask,
            );

            await expect(cron.run()).resolves.toBeUndefined();
            expect(logCronError).toHaveBeenCalledWith(
                'TaskRuleAutoCreationCron.run',
                expect.any(Error),
                expect.objectContaining<{ period: string }>({
                    period: expect.any(String) as string,
                }),
            );
        });
    });

    it('ошибка ensure для одного правила не блокирует автосоздание остальных правил этого же тика', async () => {
        await withRequestContext(async () => {
            const taskRule1 = buildTaskRule([1]);
            const taskRule2 = buildTaskRule([2]);
            const ensure = jest
                .fn()
                .mockRejectedValueOnce(new Error('bitrix down'))
                .mockResolvedValueOnce(undefined);
            const { cron } = buildCron(
                new Map([
                    [10, { rules: [taskRule1] }],
                    [20, { rules: [taskRule2] }],
                ]),
                ensure,
            );

            await expect(cron.run()).resolves.toBeUndefined();

            expect(ensure).toHaveBeenCalledTimes(2);
            expect(logCronError).toHaveBeenCalledWith(
                'TaskRuleAutoCreationCron.ensure',
                expect.any(Error),
                expect.objectContaining({ ruleId: taskRule1.id }),
            );
        });
    });
});
