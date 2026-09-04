import { GetEmployeeSalaryReportService } from './get-employee-salary-report.service';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type {
    AccountingCalculationCacheEntry,
    AccountingCalculationCachePort,
} from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { Period } from '@/shared/domain/period.value-object';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { OrderPayedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/order-payed.entity';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { SalaryAccrualStatus } from 'ireports-contracts';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';

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
        };

        const service = new GetEmployeeSalaryReportService(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            accrualRepo,
            domainSyncStatus,
            salesPlanRepo,
            contextBuilder,
            salaryRulesResolver,
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
