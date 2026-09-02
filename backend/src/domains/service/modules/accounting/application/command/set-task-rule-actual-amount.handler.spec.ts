import { withRequestContext } from '@/shared/testing/with-request-context';
import { SetTaskRuleActualAmountHandler } from './set-task-rule-actual-amount.handler';
import { SetTaskRuleActualAmountCommand } from './set-task-rule-actual-amount.command';
import type { SalaryRuleRepositoryPort } from '../ports/salary-rule.port';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import {
    TaskRuleActualAmountOutOfRangeException,
    TaskRuleNotCompletedException,
    TaskRuleNotFoundException,
} from '@/domains/service/modules/accounting/domain/exceptions/task-rule.exception';
import { AccountingPeriodClosedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import type { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';
import type { BitrixTaskBatchItem } from '@/integrations/bitrix/bitrix-tasks.service';

describe('SetTaskRuleActualAmountHandler', () => {
    const buildTaskRule = (rewardAmount = 5000, bitrixTaskIds = [3711]) =>
        withRequestContext(() =>
            TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name: 'Сдать отчёт',
                targetRole: 'ENGINEER',
                config: {
                    description: 'Описание',
                    period: '2026-08',
                    isRecurring: false,
                    dueDate: '2026-08-20',
                    rewardAmount,
                    bitrixTaskIds,
                },
            }),
        );

    const buildHandler = (overrides?: {
        rule?: SalaryRule | null;
        closedPeriod?: boolean;
        batch?: BitrixTaskBatchItem[];
    }) => {
        const findById = jest
            .fn<Promise<SalaryRule | null>, [string]>()
            .mockResolvedValue(overrides?.rule ?? null);
        const update = jest
            .fn<Promise<void>, [SalaryRule]>()
            .mockResolvedValue(undefined);
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteAllByMotivationSchema: jest.fn(),
            findById,
            update,
        };

        const closedPeriod = overrides?.closedPeriod
            ? withRequestContext(() => {
                  const period = AccountingPeriod.openFor({
                      direction: 'service',
                      period: '2026-08',
                  });
                  period.close(1, 0);
                  return period;
              })
            : null;
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: () => Promise.resolve(closedPeriod),
            save: jest.fn(),
        };
        const ensurePeriodNotClosed = new EnsurePeriodNotClosedService(
            periodRepo,
        );

        const getTasksBatch = jest
            .fn<Promise<BitrixTaskBatchItem[]>, [number[]]>()
            .mockResolvedValue(
                overrides?.batch ?? [
                    {
                        id: 3711,
                        isAvailable: true,
                        status: '5',
                        responsibleId: 42,
                        period: '2026-08',
                    },
                ],
            );
        const bitrixTasksService = {
            getTasksBatch,
        } as unknown as BitrixTasksService;

        const handler = new SetTaskRuleActualAmountHandler(
            salaryRuleRepo,
            ensurePeriodNotClosed,
            bitrixTasksService,
        );

        return { handler, findById, update, getTasksBatch };
    };

    const buildCommand = (overrides?: {
        ruleId?: string;
        period?: string;
        actualAmount?: number;
    }) =>
        new SetTaskRuleActualAmountCommand({
            ruleId: overrides?.ruleId ?? 'rule-1',
            period: overrides?.period ?? '2026-08',
            actualAmount: overrides?.actualAmount ?? 3000,
        });

    it('happy path: правило найдено, период открыт, задача "Закрыта" — upsertActualAmount и update персистятся', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskRule();
            const { handler, update } = buildHandler({ rule });

            await handler.execute(buildCommand({ actualAmount: 3000 }));

            expect(update).toHaveBeenCalledTimes(1);
            expect(update.mock.calls[0][0]).toBe(rule);
            expect(rule.actualAmounts).toEqual([
                { period: '2026-08', amount: 3000 },
            ]);
        });
    });

    it('правило не найдено — TaskRuleNotFoundException', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler({ rule: null });

            await expect(handler.execute(buildCommand())).rejects.toThrow(
                TaskRuleNotFoundException,
            );
        });
    });

    it('правило другого типа (не TaskCompleted) — TaskRuleNotFoundException', async () => {
        await withRequestContext(async () => {
            const otherRule = withRequestContext(() =>
                PayPerHoursEntity.create({
                    type: 'PayPerHour',
                    name: 'Часы',
                    targetRole: 'ENGINEER',
                    config: { price: 100 },
                }),
            );
            const { handler } = buildHandler({ rule: otherRule });

            await expect(handler.execute(buildCommand())).rejects.toThrow(
                TaskRuleNotFoundException,
            );
        });
    });

    it('период закрыт — AccountingPeriodClosedException, update не вызывается', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskRule();
            const { handler, update } = buildHandler({
                rule,
                closedPeriod: true,
            });

            await expect(handler.execute(buildCommand())).rejects.toThrow(
                AccountingPeriodClosedException,
            );
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('сумма больше суммы правила — TaskRuleActualAmountOutOfRangeException', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskRule(1000);
            const { handler, update } = buildHandler({ rule });

            await expect(
                handler.execute(buildCommand({ actualAmount: 1500 })),
            ).rejects.toThrow(TaskRuleActualAmountOutOfRangeException);
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('отрицательная сумма — TaskRuleActualAmountOutOfRangeException', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskRule(1000);
            const { handler, update } = buildHandler({ rule });

            await expect(
                handler.execute(buildCommand({ actualAmount: -1 })),
            ).rejects.toThrow(TaskRuleActualAmountOutOfRangeException);
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('0 и сумма правила — границы диапазона включительно принимаются', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskRule(1000);
            const { handler, update } = buildHandler({ rule });

            await handler.execute(buildCommand({ actualAmount: 0 }));
            await handler.execute(buildCommand({ actualAmount: 1000 }));

            expect(update).toHaveBeenCalledTimes(2);
        });
    });

    it('задача в статусе, отличном от "Закрыта" — TaskRuleNotCompletedException', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskRule();
            const { handler, update } = buildHandler({
                rule,
                batch: [
                    {
                        id: 3711,
                        isAvailable: true,
                        status: '3',
                        responsibleId: 42,
                        period: '2026-08',
                    },
                ],
            });

            await expect(handler.execute(buildCommand())).rejects.toThrow(
                TaskRuleNotCompletedException,
            );
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('задача недоступна — TaskRuleNotCompletedException', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskRule();
            const { handler, update } = buildHandler({
                rule,
                batch: [
                    {
                        id: 3711,
                        isAvailable: false,
                        status: null,
                        responsibleId: null,
                        period: null,
                    },
                ],
            });

            await expect(handler.execute(buildCommand())).rejects.toThrow(
                TaskRuleNotCompletedException,
            );
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('задача "Закрыта", но за другой период — TaskRuleNotCompletedException', async () => {
        await withRequestContext(async () => {
            const rule = buildTaskRule();
            const { handler, update } = buildHandler({
                rule,
                batch: [
                    {
                        id: 3711,
                        isAvailable: true,
                        status: '5',
                        responsibleId: 42,
                        period: '2026-09',
                    },
                ],
            });

            await expect(
                handler.execute(buildCommand({ period: '2026-08' })),
            ).rejects.toThrow(TaskRuleNotCompletedException);
            expect(update).not.toHaveBeenCalled();
        });
    });
});
