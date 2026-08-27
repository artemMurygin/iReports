import { withRequestContext } from '@/shared/testing/with-request-context';
import { EnsureBitrixTaskForPeriodService } from './ensure-bitrix-task-for-period.service';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import type { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';
import type { BitrixTaskBatchItem } from '@/integrations/bitrix/bitrix-tasks.service';

describe('EnsureBitrixTaskForPeriodService', () => {
    const buildRecurringRule = (bitrixTaskIds: number[] = [3711]) =>
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

    const buildOnceRule = (bitrixTaskIds: number[] = [3711]) =>
        withRequestContext(() =>
            TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name: 'Разовая задача',
                targetRole: 'ENGINEER',
                config: {
                    description: 'Описание',
                    period: '2026-08',
                    isRecurring: false,
                    dueDate: '2026-08-20',
                    rewardAmount: 1000,
                    bitrixTaskIds,
                },
            }),
        );

    const buildService = (overrides?: { batch?: BitrixTaskBatchItem[] }) => {
        const update = jest
            .fn<Promise<void>, [SalaryRule]>()
            .mockResolvedValue(undefined);
        const salaryRuleRepo: SalaryRuleRepositoryPort = {
            insert: jest.fn(),
            deleteAllByMotivationSchema: jest.fn(),
            findById: jest.fn(),
            update,
        };
        const createTask = jest
            .fn<Promise<number>, [unknown]>()
            .mockResolvedValue(4222);
        const getTasksBatch = jest
            .fn<Promise<BitrixTaskBatchItem[]>, [number[]]>()
            .mockResolvedValue(overrides?.batch ?? []);
        const bitrixTasksService = {
            createTask,
            getTasksBatch,
        } as unknown as BitrixTasksService;

        const service = new EnsureBitrixTaskForPeriodService(
            salaryRuleRepo,
            bitrixTasksService,
        );

        return { service, update, createTask, getTasksBatch };
    };

    it('создаёт новую задачу и добавляет её ID, если ни один текущий период не совпадает с целевым', async () => {
        await withRequestContext(async () => {
            const rule = buildRecurringRule([3711]);
            const { service, createTask, update } = buildService({
                batch: [
                    {
                        id: 3711,
                        isAvailable: true,
                        status: '5',
                        period: '2026-08',
                    },
                ],
            });

            await service.ensure(rule, '2026-09', 42);

            expect(createTask).toHaveBeenCalledTimes(1);
            expect(createTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Ежемесячный отчёт',
                    responsibleId: 42,
                    period: '2026-09',
                }),
            );
            expect(rule.bitrixTaskIds).toEqual([3711, 4222]);
            expect(update).toHaveBeenCalledTimes(1);
        });
    });

    it('идемпотентно: если текущий период уже совпадает с целевым — задача не создаётся повторно', async () => {
        await withRequestContext(async () => {
            const rule = buildRecurringRule([3711]);
            const { service, createTask, update } = buildService({
                batch: [
                    {
                        id: 3711,
                        isAvailable: true,
                        status: '2',
                        period: '2026-09',
                    },
                ],
            });

            await service.ensure(rule, '2026-09', 42);

            expect(createTask).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
            expect(rule.bitrixTaskIds).toEqual([3711]);
        });
    });

    it('повторный вызов подряд для того же периода после успешного создания больше не создаёт вторую задачу', async () => {
        await withRequestContext(async () => {
            const rule = buildRecurringRule([3711]);
            const { service, createTask, getTasksBatch } = buildService({
                batch: [
                    {
                        id: 3711,
                        isAvailable: true,
                        status: '5',
                        period: '2026-08',
                    },
                ],
            });

            await service.ensure(rule, '2026-09', 42);
            // Второй вызов видит уже добавленный 4222 среди bitrixTaskIds —
            // getTasksBatch теперь должен отдать период 2026-09 и для него.
            getTasksBatch.mockResolvedValue([
                {
                    id: 3711,
                    isAvailable: true,
                    status: '5',
                    period: '2026-08',
                },
                {
                    id: 4222,
                    isAvailable: true,
                    status: '2',
                    period: '2026-09',
                },
            ]);

            await service.ensure(rule, '2026-09', 42);

            expect(createTask).toHaveBeenCalledTimes(1);
        });
    });

    it('для разового правила (isRecurring: false) не создаёт задачу и не обращается в Bitrix24', async () => {
        await withRequestContext(async () => {
            const rule = buildOnceRule([3711]);
            const { service, createTask, getTasksBatch, update } =
                buildService();

            await service.ensure(rule, '2026-09', 42);

            expect(getTasksBatch).not.toHaveBeenCalled();
            expect(createTask).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('первый вызов правила без накопленных bitrixTaskIds создаёт задачу, не обращаясь в getTasksBatch', async () => {
        await withRequestContext(async () => {
            const rule = buildRecurringRule([]);
            const { service, createTask, getTasksBatch } = buildService();

            await service.ensure(rule, '2026-08', 42);

            expect(getTasksBatch).not.toHaveBeenCalled();
            expect(createTask).toHaveBeenCalledTimes(1);
            expect(rule.bitrixTaskIds).toEqual([4222]);
        });
    });
});
