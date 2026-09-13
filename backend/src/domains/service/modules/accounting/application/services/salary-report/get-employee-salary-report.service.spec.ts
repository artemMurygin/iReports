import { GetEmployeeSalaryReportService } from './get-employee-salary-report.service';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type {
    AccountingCalculationCacheEntry,
    AccountingCalculationCachePort,
} from '@/domains/service/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import type { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/calculation/build-service-calculation-context.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { Period } from '@/shared/domain/period.value-object';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { OrderPayedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/order-payed.entity';
import { DepartmentPercentEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/department-percent.entity';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { SalaryAccrualStatus } from 'ireports-contracts';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { EnsureRuleTaskForPeriodService } from '@/domains/service/modules/accounting/application/services/task-completion/ensure-rule-task-for-period.service';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';

// Отчёт сотрудника направления service (Фаза 13.5, см.
// docs/payroll/phase-13.5-shop-report-integration.md) — сервис строит ОДНО
// направление (service): свой AccountingPeriod, своя мотивационная схема,
// свой кэш/снапшот. Ответ односторонний — period + разбор направления, без
// directions[]/grandTotal (см. employeeSalaryReportResponseSchema в
// contracts). Все зависимости — чистые in-memory фейки, без NestJS DI и без
// БД (тот же стиль, что и у остальных юнит-тестов accounting).
describe('GetEmployeeSalaryReportService', () => {
    // Часы (Фаза 7) приходят из BuildServiceCalculationContextService, а не
    // из config — фейк ниже всегда возвращает hoursWorked: { fact: 8,
    // prognose: 8 }, чтобы старые числовые ожидания этого файла (2000 = 8ч
    // × 250, одинаково для факта и прогноза) остались верны.
    const buildSchema = (employeeId: number) =>
        withRequestContext(() => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId: employeeId,
                name: 'Оклад инженера',
                rules: [rule],
            });
        });

    const buildService = (overrides?: {
        accrualStatus?: SalaryAccrualStatus;
        schema?: MotivationSchema | null;
        accountingPeriod?: AccountingPeriod | null;
        snapshot?: Awaited<
            ReturnType<AccountingPeriodSnapshotPort['findByKey']>
        >;
        domainSyncAt?: Date | null;
        plans?: SalesPlan[];
        erpData?: Partial<ServiceCalculationErpData>;
        salesPerformanceDetail?: unknown;
        departmentSalesPerformance?: unknown;
        turnoverPerformance?: unknown;
        identities?: {
            system: string;
            identifierType: string;
            externalId: string;
        }[];
    }) => {
        const findByEmployee = jest
            .fn<Promise<MotivationSchema | null>, [number]>()
            .mockResolvedValue(overrides?.schema ?? null);
        const motivationSchemaRepo: MotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee,
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue(undefined),
            initializeName: jest.fn().mockResolvedValue(undefined),
        };

        // ResolveEmployeeSalaryRulesService.forEmployee() читает отдел
        // сотрудника через ServiceCalculationDataPort — в этих тестах у
        // сотрудника всегда нет отдела (department-схемы здесь не
        // проверяются), поэтому findEmployeeDepartmentId возвращает null и
        // forEmployee() сводится ровно к findByEmployee(), как и раньше.
        const calculationDataSource = {
            findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
        } as unknown as ServiceCalculationDataPort;
        // forEmployee() не читает findServiceAccountEmployeeIds (только
        // forAllTargets делает это, docs/employee-ordering-and-salary-filter,
        // Фаза 3) — фейк не задействуется, но нужен для сигнатуры конструктора.
        const directoryRepo = {
            findServiceAccountEmployeeIds: () =>
                Promise.resolve(new Set<number>()),
        } as unknown as DirectoryRepositoryPort;
        const salaryRulesResolver = new ResolveEmployeeSalaryRulesService(
            motivationSchemaRepo,
            calculationDataSource,
            directoryRepo,
        );

        const findByDirectionAndPeriodPeriod = jest
            .fn<Promise<AccountingPeriod | null>, [string, string]>()
            .mockResolvedValue(overrides?.accountingPeriod ?? null);
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: findByDirectionAndPeriodPeriod,
            save: jest.fn(),
        };

        const findSnapshot = jest
            .fn()
            .mockResolvedValue(overrides?.snapshot ?? null);
        const snapshotRepo: AccountingPeriodSnapshotPort = {
            saveAll: jest.fn(),
            findByKey: findSnapshot,
            findManyByKey: jest.fn().mockResolvedValue(new Map()),
            deleteByDirectionAndPeriod: jest.fn(),
        };

        const findCache = jest.fn().mockResolvedValue(null);
        const upsertCache = jest
            .fn<
                Promise<void>,
                [
                    AccountingDirection,
                    string,
                    number,
                    AccountingCalculationCacheEntry,
                ]
            >()
            .mockResolvedValue(undefined);
        const cacheRepo: AccountingCalculationCachePort = {
            find: findCache,
            upsert: upsertCache,
            deleteByDirectionAndPeriod: jest.fn(),
        };

        const getLastSuccessfulSyncAt = jest
            .fn<Promise<Date | null>, [string]>()
            .mockResolvedValue(overrides?.domainSyncAt ?? null);
        const domainSyncStatus: DomainSyncStatusPort = {
            getLastSuccessfulSyncAt,
            markSuccessful: jest.fn(),
        };

        const findPlansByDirectionAndPeriod = jest
            .fn<Promise<SalesPlan[]>, [string, string]>()
            .mockResolvedValue(overrides?.plans ?? []);
        const salesPlanRepo: SalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByDirectionAndPeriod: findPlansByDirectionAndPeriod,
        };

        const contextBuilder = {
            build: jest.fn((period: Period, employeeId: number) =>
                Promise.resolve({
                    employee: {
                        id: employeeId,
                        identities: overrides?.identities ?? [],
                    },
                    period: {
                        direction: 'service' as const,
                        period: period.getValue(),
                        ...period.getBounds(),
                        status: 'OPEN' as const,
                    },
                    erpData: overrides?.erpData ?? {
                        serviceCompletedItems: [],
                        hoursWorked: { fact: 8, prognose: 8 },
                    },
                    salesPerformanceDetail:
                        overrides?.salesPerformanceDetail ?? null,
                    // Implements FR2-FR4 of add-department-head-salary-rules — по умолчанию пустые,
                    // как и у настоящего BuildServiceCalculationContextService при схеме без
                    // department-правил; переопределяются тестами ниже, проверяющими, что оба поля
                    // реально доходят до rule.calculate().
                    departmentSalesPerformance:
                        overrides?.departmentSalesPerformance ?? new Map(),
                    turnoverPerformance:
                        overrides?.turnoverPerformance ?? new Map(),
                }),
            ),
            findSalesPerformanceForEmployee: jest.fn().mockResolvedValue(null),
        } as unknown as BuildServiceCalculationContextService;

        // Статус документа начисления (PRD 1 docs/payroll-closing-and-accrual)
        // — читается только у закрытого периода.
        const findAccrualStatus = jest
            .fn()
            .mockResolvedValue(overrides?.accrualStatus ?? null);
        const accrualRepo: SalaryAccrualRepositoryPort = {
            saveAll: jest.fn(),
            findById: jest.fn(),
            findByDirectionAndPeriod: jest.fn().mockResolvedValue([]),
            findStatusByKey: findAccrualStatus,
            deleteByDirectionAndPeriod: jest.fn(),
            // Уже отсутствовавшие в этом фейке до этого change методы порта
            // (findByIds/save/findAccruedByEmployee/findPaidByEmployee) не
            // добавляются здесь — их отсутствие не связано с разделом 16
            // tasks.md (add-task-salary-rule-links-comments), только
            // findLineByTaskId, добавленный этим разделом.
            findLineByTaskId: jest.fn().mockResolvedValue(null),
        } as unknown as SalaryAccrualRepositoryPort;

        // Ленивое достраивание задачи регулярного TaskCompletion-правила; ни
        // один фикстурный набор правил этого файла его не содержит, поэтому
        // ensure() ни разу не вызывается — мок без поведения достаточен,
        // лишь бы конструктор получил объект нужного типа.
        const ensureRuleTask = {
            ensure: jest.fn(),
        } as unknown as EnsureRuleTaskForPeriodService;

        // Задачи TaskCompletion-правил, читаемые для штампа свежести кэша
        // (taskCompletionFreshnessStamp); ни один фикстурный набор правил
        // этого файла TaskCompletion не содержит, поэтому findManyByIds
        // вовсе не вызывается (см. findTaskCompletionTasks).
        const taskRepo = {
            findManyByIds: jest.fn().mockResolvedValue([]),
        } as unknown as TaskRepositoryPort;

        const service = new GetEmployeeSalaryReportService(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            accrualRepo,
            domainSyncStatus,
            salesPlanRepo,
            taskRepo,
            contextBuilder,
            salaryRulesResolver,
            ensureRuleTask,
        );

        return {
            service,
            findAccrualStatus,
            findByEmployee,
            findByDirectionAndPeriodPeriod,
            findSnapshot,
            findCache,
            upsertCache,
            getLastSuccessfulSyncAt,
            findPlansByDirectionAndPeriod,
        };
    };

    it('отклоняет период не в формате YYYY-MM', async () => {
        await withRequestContext(async () => {
            const { service } = buildService();

            await expect(service.execute(1, '2026/08')).rejects.toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('без мотивационной схемы — пустой отчёт', async () => {
        const { service, findByEmployee } = buildService();

        const report = await service.execute(1, '2026-08');

        expect(findByEmployee).toHaveBeenCalledWith(1);
        expect(report).toEqual({
            period: '2026-08',
            direction: 'service',
            isClosed: false,
            total: { fact: 0, prognose: 0 },
            rules: [],
            salesPerformance: [],
            isPlanApproved: true,
            accrualStatus: null,
        });
    });

    it('с мотивационной схемой — считает total по PayPerHour', async () => {
        const schema = buildSchema(42);
        const { service } = buildService({ schema });

        const report = await service.execute(42, '2026-08');

        expect(report.direction).toBe('service');
        expect(report.total).toEqual({ fact: 2000, prognose: 2000 });
    });

    describe('ленивый кэш открытого периода', () => {
        it('первый запрос считает через оркестратор и пишет кэш', async () => {
            const schema = buildSchema(42);
            const { service, findCache, upsertCache } = buildService({
                schema,
            });

            await service.execute(42, '2026-08');

            expect(findCache).toHaveBeenCalledWith('service', '2026-08', 42);
            expect(upsertCache).toHaveBeenCalledTimes(1);
            expect(upsertCache.mock.calls[0][0]).toBe('service');
        });

        it('повторный запрос без изменений отдаётся из кэша и не пересчитывает', async () => {
            const schema = buildSchema(42);
            const { service, findCache, upsertCache } = buildService({
                schema,
            });

            const first = await service.execute(42, '2026-08');
            const cachedEntry = upsertCache.mock.calls[0][3];
            findCache.mockResolvedValue(cachedEntry);

            const calculateSpy = jest.spyOn(
                schema.getProps().rules[0],
                'calculate',
            );
            const second = await service.execute(42, '2026-08');

            expect(calculateSpy).not.toHaveBeenCalled();
            expect(upsertCache).toHaveBeenCalledTimes(1); // не перезаписан второй раз
            expect(second).toEqual(first);
        });
    });

    describe('закрытый период', () => {
        it('закрыт — отчёт строится из снапшота, кэш и схема не трогаются', async () => {
            const closedPeriod = withRequestContext(() => {
                const period = AccountingPeriod.openFor({
                    direction: 'service',
                    period: '2026-07',
                });
                period.close(1, 1);
                return period;
            });

            const { service, findByEmployee, upsertCache } = buildService({
                accountingPeriod: closedPeriod,
                snapshot: {
                    employeeId: 42,
                    total: 5000,
                    lines: [
                        {
                            ruleId: 'r1',
                            type: 'PayPerHour',
                            name: 'Почасовая ставка',
                            targetRole: 'ENGINEER',
                            amount: 5000,
                            sources: [],
                        },
                    ],
                },
            });

            const report = await service.execute(42, '2026-07');

            expect(report).toEqual({
                period: '2026-07',
                direction: 'service',
                isClosed: true,
                total: { fact: 5000, prognose: null },
                rules: [
                    {
                        ruleId: 'r1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        amount: { fact: 5000, prognose: null },
                        appliedPercent: undefined,
                        sources: [],
                    },
                ],
                salesPerformance: [],
                isPlanApproved: true,
                accrualStatus: null,
            });
            expect(findByEmployee).not.toHaveBeenCalled();
            expect(upsertCache).not.toHaveBeenCalled();
        });

        it('без снапшота (сотрудник без схемы на момент закрытия) отдаёт нулевой закрытый отчёт', async () => {
            const closedPeriod = withRequestContext(() => {
                const period = AccountingPeriod.openFor({
                    direction: 'service',
                    period: '2026-07',
                });
                period.close(1, 0);
                return period;
            });
            const { service } = buildService({
                accountingPeriod: closedPeriod,
                snapshot: null,
            });

            const report = await service.execute(999, '2026-07');

            expect(report.isClosed).toBe(true);
            expect(report.total).toEqual({ fact: 0, prognose: null });
        });
    });

    // Режим расчёта FACT | PROGNOSE (Фаза 9, issue #42/#46): один и тот же
    // OrderPayedEntity.calculate() вызывается дважды с разным входным
    // percentCompletion (факт/прогноз отдела), база продаж сотрудника
    // (orderPayedItems) не меняется между проходами.
    describe('режим расчёта FACT | PROGNOSE (FloatPercent)', () => {
        const borders = [
            {
                name: 'A',
                fromPlanPercent: 50,
                multiplier: 0.5,
                mode: 'FIX' as const,
            },
            {
                name: 'B',
                fromPlanPercent: 70,
                multiplier: 1,
                mode: 'FIX' as const,
            },
            {
                name: 'C',
                fromPlanPercent: 100,
                multiplier: 1.5,
                mode: 'FIX' as const,
            },
        ];

        const buildFloatPercentSchema = () =>
            withRequestContext(() => {
                const rule = OrderPayedEntity.create({
                    type: 'OrderPayed',
                    name: 'Процент от выручки по плану',
                    targetRole: 'ENGINEER',
                    config: {
                        award: {
                            type: 'FloatPercent',
                            basePercent: 10,
                            salaryBasis: 'REVENUE',
                            percentBorders: borders,
                        },
                    },
                });
                return MotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 42,
                    name: 'Инженер на проценте',
                    rules: [rule],
                });
            });

        const orderPayedItem = {
            orderId: 1,
            managerId: null,
            onlineManager: null,
            engineerIds: [999],
            revenue: 1000,
            cost: 0,
            engineerSalary: 0,
        };

        const identities = [
            {
                system: 'ROAPP' as const,
                identifierType: 'EMPLOYEE_ID' as const,
                externalId: '999',
            },
        ];

        const fakePerformance = (
            factPercent: number,
            prognosePercent: number,
        ) => ({
            getDepartment: () => 1,
            getCategory: () => null,
            getFact: () => ({
                getPercentCompletion: () => factPercent,
                getTurnover: () => 0,
                getMargin: () => 0,
            }),
            getPrognose: () => ({
                getPercentCompletion: () => prognosePercent,
                getTurnover: () => 0,
                getMargin: () => 0,
            }),
            getPlan: () => ({
                turnover: 0,
                margin: 0,
                status: 'APPROVED' as const,
            }),
        });

        it('прогнозный процент в другом пороге меняет прогнозную сумму отчёта относительно факта', async () => {
            const schema = buildFloatPercentSchema();
            // Факт — 65% (порог 50%, множитель 0.5) -> 1000*10%*0.5 = 50.
            // Прогноз — 70% (порог 70%, множитель 1) -> 1000*10%*1 = 100.
            const { service } = buildService({
                schema,
                erpData: {
                    serviceCompletedItems: [],
                    hoursWorked: { fact: 0, prognose: 0 },
                    orderPayedItems: [orderPayedItem],
                },
                identities,
                salesPerformanceDetail: fakePerformance(65, 70),
            });

            const report = await service.execute(42, '2026-08');
            const [rule] = report.rules;

            expect(rule.amount.fact).toBe(50);
            expect(rule.amount.prognose).toBe(100);
            expect(rule.amount.fact).not.toBe(rule.amount.prognose);
            expect(report.total).toEqual({ fact: 50, prognose: 100 });
        });
    });

    // Implements FR2-FR4 of add-department-head-salary-rules.
    //
    // buildOpenServiceDirection() строит два CalculationContext (FACT/PROGNOSE) перечислением полей
    // явно, а не спредом полного baseContext — departmentSalesPerformance/turnoverPerformance,
    // которые BuildServiceCalculationContextService уже резолвит, должны доходить до
    // rule.calculate() DepartmentPercent/DepartmentPlanBonus/DepartmentTurnoverBonus правил, иначе
    // те молча считают 0 (design.md Q2, "no data for scope → 0, no throw").
    describe('departmentSalesPerformance / turnoverPerformance доходят до rule.calculate()', () => {
        it('DepartmentPercent считает по departmentSalesPerformance из контекста', async () => {
            const rule = withRequestContext(() =>
                DepartmentPercentEntity.create({
                    type: 'DepartmentPercent',
                    name: 'Процент от факта',
                    targetRole: 'DEPARTMENT_HEAD',
                    config: {
                        salaryBasis: 'REVENUE',
                        category: 'cat-1',
                        percent: 10,
                    },
                }),
            );
            const schema = withRequestContext(() =>
                MotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 42,
                    name: 'Руководитель отдела',
                    rules: [rule],
                }),
            );

            const { service } = buildService({
                schema,
                // fact.turnover=100000 * percent 10% = 10000
                departmentSalesPerformance: new Map([
                    [
                        'cat-1',
                        {
                            fact: { turnover: 100000, margin: 0 },
                            percentCompletion: 80,
                        },
                    ],
                ]),
            });

            const report = await service.execute(42, '2026-08');

            expect(report.total).toEqual({ fact: 10000, prognose: 10000 });
        });
    });

    // PRD 1 docs/payroll-closing-and-accrual: отчёт за закрытый период
    // дополняется статусом документа начисления сотрудника.
    it('за закрытый период отдаёт статус документа начисления сотрудника', async () => {
        const closedPeriod = withRequestContext(() => {
            const period = AccountingPeriod.openFor({
                direction: 'service',
                period: '2026-07',
            });
            period.close(1, 1);
            return period;
        });
        const { service, findAccrualStatus } = buildService({
            accountingPeriod: closedPeriod,
            accrualStatus: 'DRAFT',
        });

        const report = await service.execute(42, '2026-07');

        expect(findAccrualStatus).toHaveBeenCalledWith(
            'service',
            '2026-07',
            42,
        );
        expect(report.isClosed).toBe(true);
        expect(report.accrualStatus).toBe('DRAFT');
    });
});
