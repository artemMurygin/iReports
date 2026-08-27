import { withRequestContext } from '@/shared/testing/with-request-context';
import { BuildServiceCalculationContextService } from './build-service-calculation-context.service';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import { Period } from '@/shared/domain/period.value-object';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';
import type { BitrixTaskBatchItem } from '@/integrations/bitrix/bitrix-tasks.service';

// spec.md, Requirement "Расчёт факта и прогноза по статусу задачи
// Bitrix24" → сценарий "Пакетный запрос статусов при большом числе правил":
// не более одного batched-вызова getTasksBatch на весь расчёт, независимо
// от числа правил TaskCompleted.
describe('BuildServiceCalculationContextService', () => {
    const buildTaskRule = (bitrixTaskIds: number[], name = 'Задача') =>
        withRequestContext(() =>
            TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name,
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

    const buildService = (batch: BitrixTaskBatchItem[] = []) => {
        const dataSource: ServiceCalculationDataPort = {
            findEmployeeIdentities: jest.fn().mockResolvedValue([]),
            findServiceCompletedItems: jest.fn().mockResolvedValue([]),
            findHoursWorked: jest
                .fn()
                .mockResolvedValue({ fact: 0, prognose: 0 }),
            findOrderPayedItems: jest.fn().mockResolvedValue([]),
            findConfirmedTaskCompletions: jest.fn().mockResolvedValue([]),
            findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
            findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
            findEmployeeIdentitiesForEmployees: jest
                .fn()
                .mockResolvedValue(new Map()),
            findHoursWorkedForEmployees: jest.fn().mockResolvedValue(new Map()),
        };
        const salesPerformanceReader: SalesPerformanceReaderPort = {
            listForPeriod: jest.fn().mockResolvedValue([]),
            findForScope: jest.fn().mockResolvedValue(null),
        };
        const getTasksBatch = jest
            .fn<Promise<BitrixTaskBatchItem[]>, [number[]]>()
            .mockResolvedValue(batch);
        const bitrixTasksService = {
            getTasksBatch,
        } as unknown as BitrixTasksService;

        const service = new BuildServiceCalculationContextService(
            dataSource,
            salesPerformanceReader,
            bitrixTasksService,
        );

        return { service, getTasksBatch };
    };

    it('несколько правил TaskCompleted — ровно один вызов getTasksBatch на все их bitrixTaskIds разом', async () => {
        await withRequestContext(async () => {
            const rules: SalaryRule[] = [
                buildTaskRule([101], 'Первая'),
                buildTaskRule([102, 103], 'Вторая'),
            ];
            const { service, getTasksBatch } = buildService([
                {
                    id: 101,
                    isAvailable: true,
                    status: '5',
                    responsibleId: 42,
                    period: '2026-08',
                },
                {
                    id: 102,
                    isAvailable: true,
                    status: '2',
                    responsibleId: 42,
                    period: '2026-08',
                },
                {
                    id: 103,
                    isAvailable: true,
                    status: '3',
                    responsibleId: 42,
                    period: '2026-08',
                },
            ]);

            await service.build(Period.create('2026-08'), 1, rules);

            expect(getTasksBatch).toHaveBeenCalledTimes(1);
            expect(getTasksBatch).toHaveBeenCalledWith([101, 102, 103]);
        });
    });

    it('заполняет erpData.bitrixTaskStatuses нормализованными бизнес-статусами', async () => {
        await withRequestContext(async () => {
            const rules: SalaryRule[] = [buildTaskRule([101])];
            const { service } = buildService([
                {
                    id: 101,
                    isAvailable: true,
                    status: '5',
                    responsibleId: 42,
                    period: '2026-08',
                },
            ]);

            const context = await service.build(
                Period.create('2026-08'),
                1,
                rules,
            );

            expect(context.erpData.bitrixTaskStatuses).toEqual([
                {
                    id: 101,
                    isAvailable: true,
                    status: 'COMPLETED',
                    period: '2026-08',
                },
            ]);
        });
    });

    it('без правил TaskCompleted — не вызывает getTasksBatch вовсе', async () => {
        await withRequestContext(async () => {
            const rules: SalaryRule[] = [
                withRequestContext(() =>
                    PayPerHoursEntity.create({
                        type: 'PayPerHour',
                        name: 'Часы',
                        targetRole: 'ENGINEER',
                        config: { price: 100 },
                    }),
                ),
            ];
            const { service, getTasksBatch } = buildService();

            const context = await service.build(
                Period.create('2026-08'),
                1,
                rules,
            );

            expect(getTasksBatch).not.toHaveBeenCalled();
            expect(context.erpData.bitrixTaskStatuses).toEqual([]);
        });
    });

    it('дедуплицирует bitrixTaskIds, если он вдруг совпал между правилами', async () => {
        await withRequestContext(async () => {
            const rules: SalaryRule[] = [
                buildTaskRule([101], 'A'),
                buildTaskRule([101], 'B'),
            ];
            const { service, getTasksBatch } = buildService([
                {
                    id: 101,
                    isAvailable: true,
                    status: '5',
                    responsibleId: 42,
                    period: '2026-08',
                },
            ]);

            await service.build(Period.create('2026-08'), 1, rules);

            expect(getTasksBatch).toHaveBeenCalledWith([101]);
        });
    });
});
