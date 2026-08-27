import type { EventEmitter2 } from '@nestjs/event-emitter';
import { GetClosePeriodPreviewService } from './get-close-period-preview.service';
import { CalculateServiceSnapshotRowsService } from './calculate-service-snapshot-rows.service';
import { ErpPeriodSyncRunner } from './erp-period-sync-runner.service';
import { ResolveEmployeeSalaryRulesService } from './resolve-employee-salary-rules.service';
import { ListUnclosedTaskRulesForPeriodService } from './list-unclosed-task-rules-for-period.service';
import type { BuildServiceCalculationContextService } from './build-service-calculation-context.service';
import type { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';
import { CloseAccountingPeriodHandler } from '@/domains/service/modules/accounting/application/command/close-accounting-period.handler';
import { CloseAccountingPeriodCommand } from '@/domains/service/modules/accounting/application/command/close-accounting-period.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { EmployeeDismissalPort } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import type { BitrixTaskBatchItem } from '@/integrations/bitrix/bitrix-tasks.service';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { Period } from '@/shared/domain/period.value-object';
import { withRequestContext } from '@/shared/testing/with-request-context';

// PRD 1 docs/payroll-closing-and-accrual: "значения окна подтверждения
// совпадают с ответом close-preview" — preview и закрытие считают строки
// одним и тем же CalculateServiceSnapshotRowsService (SNAPSHOT_ROWS_CALCULATOR).
describe('GetClosePeriodPreviewService', () => {
    const PERIOD = '2026-07';

    const buildHourlySchema = (targetId: number, price: number) =>
        withRequestContext(() => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId,
                name: 'Оклад инженера',
                rules: [rule],
            });
        });

    const buildScheduleEntry = (employeeId: number, hours: number) =>
        withRequestContext(() =>
            WorkScheduleEntry.create({
                employeeId,
                date: ScheduleDate.create(`${PERIOD}-15`),
                day: WorkDay.create({ status: 'WORKING', hours }),
            }),
        );

    const buildPlan = (approved: boolean) =>
        withRequestContext(() => {
            const plan = SalesPlan.create({
                direction: 'service',
                department: 1,
                category: null,
                period: PERIOD,
                turnover: 1000,
                margin: 100,
                source: 'MANUAL',
            });
            if (approved) {
                plan.approve(1);
            }
            return plan;
        });

    const buildTaskSchema = (employeeId: number, taskIds: number[]) =>
        withRequestContext(() => {
            const rule = TaskCompletedEntity.create({
                type: 'TaskCompleted',
                name: 'Задача',
                targetRole: 'ENGINEER',
                config: {
                    description: 'Описание',
                    period: PERIOD,
                    isRecurring: false,
                    dueDate: `${PERIOD}-20`,
                    rewardAmount: 1000,
                    bitrixTaskIds: taskIds,
                },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId: employeeId,
                name: 'Схема с задачей',
                rules: [rule],
            });
        });

    const setup = (options: {
        schemas: MotivationSchema[];
        plans: SalesPlan[];
        dismissedEmployeeIds: number[];
        scheduleEntries: WorkScheduleEntry[];
        hoursByEmployee: Record<number, number>;
        bitrixBatch?: BitrixTaskBatchItem[];
    }) => {
        const motivationSchemaRepo = {
            findAllEmployeeTargets: jest
                .fn()
                .mockResolvedValue(options.schemas),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findByDepartment: jest.fn().mockResolvedValue(null),
        } as unknown as MotivationSchemaRepositoryPort;
        const calculationDataSource = {
            findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
        } as unknown as ServiceCalculationDataPort;
        const contextBuilder = {
            build: jest.fn((period: Period, employeeId: number) =>
                Promise.resolve({
                    employee: { id: employeeId, identities: [] },
                    period: {
                        direction: 'service' as const,
                        period: period.getValue(),
                        ...period.getBounds(),
                        status: 'OPEN' as const,
                    },
                    erpData: {
                        serviceCompletedItems: [],
                        hoursWorked: {
                            fact: options.hoursByEmployee[employeeId] ?? 0,
                            prognose: options.hoursByEmployee[employeeId] ?? 0,
                        },
                    },
                    salesPerformanceDetail: null,
                }),
            ),
        } as unknown as BuildServiceCalculationContextService;
        const salaryRulesResolver = new ResolveEmployeeSalaryRulesService(
            motivationSchemaRepo,
            calculationDataSource,
        );
        const rowsCalculator = new CalculateServiceSnapshotRowsService(
            contextBuilder,
            salaryRulesResolver,
        );
        const bitrixTasksService = {
            getTasksBatch: jest
                .fn()
                .mockResolvedValue(options.bitrixBatch ?? []),
        } as unknown as BitrixTasksService;
        const listUnclosedTaskRules = new ListUnclosedTaskRulesForPeriodService(
            salaryRulesResolver,
            bitrixTasksService,
        );
        const salesPlanRepo = {
            findByDirectionAndPeriod: jest
                .fn()
                .mockResolvedValue(options.plans),
        } as unknown as SalesPlanRepositoryPort;
        const employeeDismissal: EmployeeDismissalPort = {
            findDismissedEmployeeIds: jest.fn((ids: number[]) =>
                Promise.resolve(
                    new Set(
                        ids.filter((id) =>
                            options.dismissedEmployeeIds.includes(id),
                        ),
                    ),
                ),
            ),
        };
        const workScheduleRepo = {
            findByEmployeeIdsAndDateRange: jest
                .fn()
                .mockResolvedValue(options.scheduleEntries),
        } as unknown as WorkScheduleEntryRepositoryPort;

        const preview = new GetClosePeriodPreviewService(
            salesPlanRepo,
            rowsCalculator,
            employeeDismissal,
            workScheduleRepo,
            listUnclosedTaskRules,
        );

        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: jest.fn().mockResolvedValue(null),
            save: jest.fn().mockResolvedValue(undefined),
        };
        const snapshotRepo = {
            saveAll: jest.fn().mockResolvedValue(undefined),
        } as unknown as AccountingPeriodSnapshotPort;
        const cacheRepo = {
            deleteByDirectionAndPeriod: jest.fn().mockResolvedValue(undefined),
        } as unknown as AccountingCalculationCachePort;
        const accrualRepo = new InMemorySalaryAccrualRepository();
        const unitOfWork: UnitOfWorkPort = { run: (work) => work() };
        const eventEmitter = {
            emitAsync: jest.fn().mockResolvedValue([]),
        } as unknown as EventEmitter2;
        const close = new CloseAccountingPeriodHandler(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            salesPlanRepo,
            accrualRepo,
            employeeDismissal,
            unitOfWork,
            eventEmitter,
            rowsCalculator,
            new ErpPeriodSyncRunner({
                syncPeriod: jest.fn().mockResolvedValue(undefined),
            }),
        );

        return { preview, close, accrualRepo, snapshotRepo };
    };

    it('сводка совпадает с результатом реального закрытия: число документов, уволенные, фонд оплаты', async () => {
        const { preview, close, accrualRepo } = setup({
            schemas: [
                buildHourlySchema(1, 250),
                buildHourlySchema(2, 300),
                buildHourlySchema(3, 100),
            ],
            plans: [buildPlan(true)],
            dismissedEmployeeIds: [3],
            scheduleEntries: [buildScheduleEntry(1, 10)],
            hoursByEmployee: { 1: 10, 2: 8, 3: 0 },
        });

        const summary = await withRequestContext(() =>
            preview.execute('service', PERIOD),
        );
        await withRequestContext(() =>
            close.execute(
                new CloseAccountingPeriodCommand({
                    period: PERIOD,
                    closedBy: 7,
                }),
            ),
        );

        const accruals = await accrualRepo.findByDirectionAndPeriod(
            'service',
            PERIOD,
        );
        expect(summary).toEqual({
            direction: 'service',
            period: PERIOD,
            employeesCount: accruals.length,
            dismissedEmployeesCount: accruals.filter((a) => a.isDismissed)
                .length,
            totalAmount: accruals.reduce((sum, a) => sum + a.total, 0),
            unapprovedPlanRows: [],
            // Сотрудники 2 и 3 с PayPerHour без записи часов за месяц.
            employeesWithoutHours: 2,
            unclosedTaskRules: [],
        });
        expect(summary.employeesCount).toBe(3);
        expect(summary.dismissedEmployeesCount).toBe(1);
        expect(summary.totalAmount).toBe(10 * 250 + 8 * 300);
    });

    it('перечисляет неутверждённые строки плана — те же, из-за которых закрытие будет отклонено', async () => {
        const unapproved = buildPlan(false);
        const { preview, close } = setup({
            schemas: [buildHourlySchema(1, 250)],
            plans: [buildPlan(true), unapproved],
            dismissedEmployeeIds: [],
            scheduleEntries: [],
            hoursByEmployee: { 1: 10 },
        });

        const summary = await withRequestContext(() =>
            preview.execute('service', PERIOD),
        );
        expect(summary.unapprovedPlanRows).toEqual([
            { id: unapproved.id, department: 1, category: null },
        ]);

        const error = await withRequestContext(() =>
            close
                .execute(
                    new CloseAccountingPeriodCommand({
                        period: PERIOD,
                        closedBy: 7,
                    }),
                )
                .catch((e: unknown) => e as { metadata: unknown }),
        );
        expect(error.metadata).toEqual({ rows: summary.unapprovedPlanRows });
    });

    it('employeesWithoutHours считает сотрудников с PayPerHour без записи часов за месяц (PRD 1: руководитель может отменить закрытие и дозаполнить)', async () => {
        const { preview } = setup({
            schemas: [
                buildHourlySchema(1, 250),
                buildHourlySchema(2, 250),
                buildHourlySchema(3, 250),
            ],
            plans: [],
            dismissedEmployeeIds: [],
            scheduleEntries: [buildScheduleEntry(2, 8)],
            hoursByEmployee: { 2: 8 },
        });

        const summary = await withRequestContext(() =>
            preview.execute('service', PERIOD),
        );
        // Сотрудники 1 и 3 — с правилом PayPerHour, но без записи часов; все
        // трое при этом попадают в снапшот (нулевая сумма документ не отменяет).
        expect(summary.employeesWithoutHours).toBe(2);
        expect(summary.employeesCount).toBe(3);
    });

    it('employeesWithoutHours = 0, если правил PayPerHour нет или у всех есть записи часов', async () => {
        const { preview } = setup({
            schemas: [buildHourlySchema(1, 250)],
            plans: [],
            dismissedEmployeeIds: [],
            scheduleEntries: [buildScheduleEntry(1, 10)],
            hoursByEmployee: { 1: 10 },
        });

        const summary = await withRequestContext(() =>
            preview.execute('service', PERIOD),
        );
        expect(summary.employeesWithoutHours).toBe(0);
    });

    // Задача 10.4 change salary-rule-bitrix-task: список незакрытых правил-
    // задач доступен через тот же close-preview, что уже читает
    // ClosePeriodDialog на фронте (design.md, задача 6.6).
    it('unclosedTaskRules — правило-задача не в статусе "Закрыта" за период, только для direction service', async () => {
        const { preview } = setup({
            schemas: [buildTaskSchema(1, [101])],
            plans: [],
            dismissedEmployeeIds: [],
            scheduleEntries: [],
            hoursByEmployee: {},
            bitrixBatch: [
                {
                    id: 101,
                    isAvailable: true,
                    status: '3',
                    responsibleId: 1,
                    period: PERIOD,
                },
            ],
        });

        const serviceSummary = await withRequestContext(() =>
            preview.execute('service', PERIOD),
        );
        expect(serviceSummary.unclosedTaskRules).toHaveLength(1);
        expect(serviceSummary.unclosedTaskRules[0]).toMatchObject({
            employeeId: 1,
            bitrixTaskId: 101,
            status: 'IN_PROGRESS',
            isUnavailable: false,
        });

        const shopSummary = await withRequestContext(() =>
            preview.execute('shop', PERIOD),
        );
        expect(shopSummary.unclosedTaskRules).toEqual([]);
    });
});
