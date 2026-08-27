import { withRequestContext } from '@/shared/testing/with-request-context';
import { EnsureTaskRulesOnReadService } from './ensure-task-rules-on-read.service';
import type { EnsureBitrixTaskForPeriodService } from './ensure-bitrix-task-for-period.service';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

describe('EnsureTaskRulesOnReadService', () => {
    const buildTaskRule = (bitrixTaskIds: number[] = [3711]) =>
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

    const buildService = () => {
        const ensure = jest.fn().mockResolvedValue(undefined);
        const ensureBitrixTask = {
            ensure,
        } as unknown as EnsureBitrixTaskForPeriodService;
        const service = new EnsureTaskRulesOnReadService(ensureBitrixTask);
        return { service, ensure };
    };

    it('вызывает ensure только для правил TaskCompleted, остальные типы пропускает', async () => {
        await withRequestContext(async () => {
            const taskRule = buildTaskRule();
            const otherRule = buildOtherRule();
            const rules: SalaryRule[] = [otherRule, taskRule];
            const { service, ensure } = buildService();

            await service.ensureAll(rules, 42, '2026-09');

            expect(ensure).toHaveBeenCalledTimes(1);
            expect(ensure).toHaveBeenCalledWith(taskRule, '2026-09', 42);
        });
    });

    it('повторный вызов за тот же период не плодит вторую задачу — делегирует идемпотентность ensure()', async () => {
        await withRequestContext(async () => {
            const taskRule = buildTaskRule();
            const { service, ensure } = buildService();

            await service.ensureAll([taskRule], 42, '2026-09');
            await service.ensureAll([taskRule], 42, '2026-09');

            expect(ensure).toHaveBeenCalledTimes(2);
            expect(ensure).toHaveBeenNthCalledWith(1, taskRule, '2026-09', 42);
            expect(ensure).toHaveBeenNthCalledWith(2, taskRule, '2026-09', 42);
        });
    });

    it('пустой список правил — не обращается к ensure', async () => {
        await withRequestContext(async () => {
            const { service, ensure } = buildService();

            await service.ensureAll([], 42, '2026-09');

            expect(ensure).not.toHaveBeenCalled();
        });
    });
});
