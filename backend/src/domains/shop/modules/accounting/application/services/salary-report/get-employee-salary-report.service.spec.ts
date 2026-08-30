import { GetShopEmployeeSalaryReportService } from './get-employee-salary-report.service';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { ShopAccountingPeriodSnapshotPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type {
    ShopAccountingCalculationCacheEntry,
    ShopAccountingCalculationCachePort,
} from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/calculation/resolve-employee-salary-rules.service';
import type { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/calculation/build-calculation-context.service';
import { Period } from '@/shared/domain/period.value-object';
import { ShopAccountingPeriod } from '@/domains/shop/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { ShopSalesPlan } from '@/domains/shop/modules/sales/domain/entities/sales-plan.entity';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/product-sold.entity';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import type { SalaryAccrualStatus } from 'ireports-contracts';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';

// Отчёт по зарплате сотрудника магазина (Фаза 13.5, см.
// docs/payroll/phase-13.5-shop-report-integration.md) — сервис строит
// ТОЛЬКО направление shop (в отличие от исторического
// GetEmployeeSalaryReportService, который сводил оба направления в
// grandTotal): свой AccountingPeriod, своя мотивационная схема, свой
// кэш/снапшот. Все зависимости — чистые in-memory фейки, без NestJS DI и
// без БД (тот же стиль, что и у остальных юнит-тестов accounting).
describe('GetShopEmployeeSalaryReportService', () => {
    // Часы (Фаза 7/12) приходят из BuildShopCalculationContextService, а не
    // из config — фейки ниже всегда возвращают hoursWorked: { fact: 8,
    // prognose: 8 }, чтобы числовое ожидание (800 = 8ч × 100, одинаково для
    // факта и прогноза) было верным.
    const buildShopSchema = (employeeId: number) =>
        withRequestContext(() => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка (магазин)',
                targetRole: 'OFFLINE_MANAGER',
                config: { price: 100 },
            });
            return ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId: employeeId,
                name: 'Оклад продавца',
                rules: [rule],
            });
        });

    const buildService = (overrides?: {
        accrualStatus?: SalaryAccrualStatus;
        shopSchema?: ShopMotivationSchema | null;
        shopAccountingPeriod?: ShopAccountingPeriod | null;
        shopSnapshot?: Awaited<
            ReturnType<ShopAccountingPeriodSnapshotPort['findByKey']>
        >;
        shopDomainSyncAt?: Date | null;
        shopPlans?: ShopSalesPlan[];
        shopErpData?: Partial<ShopCalculationErpData>;
        shopSalesPerformanceDetail?: unknown;
        shopIdentities?: {
            system: string;
            identifierType: string;
            externalId: string;
        }[];
    }) => {
        const findShopByEmployee = jest
            .fn<Promise<ShopMotivationSchema | null>, [number]>()
            .mockResolvedValue(overrides?.shopSchema ?? null);
        const shopMotivationSchemaRepo = {
            insert: jest.fn(),
            findByEmployee: findShopByEmployee,
            findByDepartment: jest.fn().mockResolvedValue(null),
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findAllDepartmentTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
            findAll: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
        } as unknown as ShopMotivationSchemaRepositoryPort;

        // ResolveShopEmployeeSalaryRulesService.forEmployee() читает отдел
        // сотрудника через ShopCalculationDataPort — в этих тестах у
        // сотрудника всегда нет отдела (department-схемы здесь не
        // проверяются), поэтому findEmployeeDepartmentId возвращает null и
        // forEmployee() сводится ровно к findByEmployee(), как и раньше.
        const salaryRulesResolver = new ResolveShopEmployeeSalaryRulesService(
            shopMotivationSchemaRepo,
            {
                findEmployeeDepartmentId: jest.fn().mockResolvedValue(null),
                findEmployeesInDepartment: jest.fn().mockResolvedValue([]),
            } as unknown as ShopCalculationDataPort,
        );

        const findByPeriod = jest
            .fn<Promise<ShopAccountingPeriod | null>, [string]>()
            .mockResolvedValue(overrides?.shopAccountingPeriod ?? null);
        const periodRepo: ShopAccountingPeriodRepositoryPort = {
            findByPeriod,
            save: jest.fn(),
        };

        const findSnapshot = jest
            .fn()
            .mockResolvedValue(overrides?.shopSnapshot ?? null);
        const snapshotRepo: ShopAccountingPeriodSnapshotPort = {
            saveAll: jest.fn(),
            findByKey: findSnapshot,
            findManyByKey: jest.fn().mockResolvedValue(new Map()),
            deleteByPeriod: jest.fn(),
        };

        const findCache = jest.fn().mockResolvedValue(null);
        const upsertCache = jest
            .fn<
                Promise<void>,
                [string, number, ShopAccountingCalculationCacheEntry]
            >()
            .mockResolvedValue(undefined);
        const cacheRepo: ShopAccountingCalculationCachePort = {
            find: findCache,
            upsert: upsertCache,
            deleteByPeriod: jest.fn(),
        };

        const getLastSuccessfulSyncAt = jest
            .fn<Promise<Date | null>, [string]>()
            .mockResolvedValue(overrides?.shopDomainSyncAt ?? null);
        const domainSyncStatus: DomainSyncStatusPort = {
            getLastSuccessfulSyncAt,
            markSuccessful: jest.fn(),
        };

        const findPlansByPeriod = jest
            .fn<Promise<ShopSalesPlan[]>, [string]>()
            .mockResolvedValue(overrides?.shopPlans ?? []);
        const salesPlanRepo: ShopSalesPlanRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByScope: jest.fn(),
            findByPeriod: findPlansByPeriod,
        };

        const shopContextBuilder = {
            build: jest.fn((period: Period, employeeId: number) =>
                Promise.resolve({
                    employee: {
                        id: employeeId,
                        identities: overrides?.shopIdentities ?? [],
                    },
                    period: {
                        direction: 'shop' as const,
                        period: period.getValue(),
                        ...period.getBounds(),
                        status: 'OPEN' as const,
                    },
                    erpData: overrides?.shopErpData ?? {
                        hoursWorked: { fact: 8, prognose: 8 },
                    },
                    salesPerformanceDetail:
                        overrides?.shopSalesPerformanceDetail ?? null,
                    // Карта по категориям (Фаза 2 плана
                    // shop-sales-performance-by-category) — ключ null
                    // зеркалит salesPerformanceDetail (отдел целиком), тот
                    // же приём, что и в BuildShopCalculationContextService.
                    // resolveSalesPerformanceByCategory.
                    salesPerformanceByCategory:
                        overrides?.shopSalesPerformanceDetail
                            ? new Map([
                                  [null, overrides.shopSalesPerformanceDetail],
                              ])
                            : new Map(),
                    // Сырые строки для агрегированной сводки "план продаж
                    // отдела" в ответе (см. buildSalesPerformanceSummary) —
                    // зеркалит salesPerformanceDetail единственной записью
                    // "весь отдел" (category: null), тот же приём, что и у
                    // salesPerformanceByCategory выше.
                    salesPerformanceByDepartment:
                        overrides?.shopSalesPerformanceDetail
                            ? [overrides.shopSalesPerformanceDetail]
                            : [],
                }),
            ),
            findSalesPerformanceForEmployee: jest.fn().mockResolvedValue(null),
            findSalesPerformanceByDepartmentForEmployee: jest
                .fn()
                .mockResolvedValue(
                    overrides?.shopSalesPerformanceDetail
                        ? [overrides.shopSalesPerformanceDetail]
                        : [],
                ),
        } as unknown as BuildShopCalculationContextService;

        // Статус документа начисления (PRD 1 docs/payroll-closing-and-accrual)
        // — читается только у закрытого периода.
        const findAccrualStatus = jest
            .fn()
            .mockResolvedValue(overrides?.accrualStatus ?? null);
        const accrualRepo: ShopSalaryAccrualRepositoryPort = {
            saveAll: jest.fn(),
            findById: jest.fn(),
            findByIds: jest.fn(),
            findByPeriod: jest.fn().mockResolvedValue([]),
            findStatusByKey: findAccrualStatus,
            deleteByPeriod: jest.fn(),
            findAccruedByEmployee: jest.fn().mockResolvedValue([]),
            findPaidByEmployee: jest.fn().mockResolvedValue([]),
            save: jest.fn(),
        };

        const service = new GetShopEmployeeSalaryReportService(
            periodRepo,
            snapshotRepo,
            cacheRepo,
            accrualRepo,
            domainSyncStatus,
            salesPlanRepo,
            shopContextBuilder,
            salaryRulesResolver,
        );

        return {
            service,
            findAccrualStatus,
            findShopByEmployee,
            findByPeriod,
            findSnapshot,
            findCache,
            upsertCache,
            getLastSuccessfulSyncAt,
            findPlansByPeriod,
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

    it('без мотивационной схемы — пустой отчёт направления shop', async () => {
        const { service, findShopByEmployee } = buildService();

        const report = await service.execute(1, '2026-08');

        expect(findShopByEmployee).toHaveBeenCalledWith(1);
        expect(report).toEqual({
            period: '2026-08',
            direction: 'shop',
            isClosed: false,
            total: { fact: 0, prognose: 0 },
            rules: [],
            salesPerformance: [],
            isPlanApproved: true,
            accrualStatus: null,
        });
    });

    it('с мотивационной схемой — total считается через оркестратор (8ч × 100 = 800)', async () => {
        const shopSchema = buildShopSchema(42);
        const { service } = buildService({ shopSchema });

        const report = await service.execute(42, '2026-08');

        expect(report.direction).toBe('shop');
        expect(report.total).toEqual({ fact: 800, prognose: 800 });
        expect(report.rules).toHaveLength(1);
    });

    describe('ленивый кэш открытого периода', () => {
        it('первый запрос считает через оркестратор и пишет кэш', async () => {
            const shopSchema = buildShopSchema(42);
            const { service, findCache, upsertCache } = buildService({
                shopSchema,
            });

            await service.execute(42, '2026-08');

            expect(findCache).toHaveBeenCalledWith('2026-08', 42);
            expect(upsertCache).toHaveBeenCalledTimes(1);
            expect(upsertCache.mock.calls[0][0]).toBe('2026-08');
        });

        it('повторный запрос без изменений отдаётся из кэша и не пересчитывает', async () => {
            const shopSchema = buildShopSchema(42);
            const { service, findCache, upsertCache } = buildService({
                shopSchema,
            });

            const first = await service.execute(42, '2026-08');
            const [, , cachedEntry] = upsertCache.mock.calls[0];
            findCache.mockResolvedValue(cachedEntry);

            const calculateSpy = jest.spyOn(
                shopSchema.getProps().rules[0],
                'calculate',
            );
            const second = await service.execute(42, '2026-08');

            expect(calculateSpy).not.toHaveBeenCalled();
            expect(upsertCache).toHaveBeenCalledTimes(1); // не перезаписан второй раз
            expect(second).toEqual(first);
        });
    });

    describe('закрытый период', () => {
        it('строится из снапшота, кэш и схема не трогаются', async () => {
            const closedShopPeriod = withRequestContext(() => {
                const period = ShopAccountingPeriod.openFor('2026-07');
                period.close(1, 1);
                return period;
            });

            const { service, findShopByEmployee, upsertCache } = buildService({
                shopAccountingPeriod: closedShopPeriod,
                shopSnapshot: {
                    employeeId: 42,
                    total: 1500,
                    lines: [
                        {
                            ruleId: 'r2',
                            type: 'PayPerHour',
                            name: 'Почасовая ставка (магазин)',
                            targetRole: 'OFFLINE_MANAGER',
                            amount: 1500,
                            sources: [],
                        },
                    ],
                },
            });

            const report = await service.execute(42, '2026-07');

            expect(report).toEqual({
                period: '2026-07',
                direction: 'shop',
                isClosed: true,
                total: { fact: 1500, prognose: null },
                rules: [
                    {
                        ruleId: 'r2',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка (магазин)',
                        targetRole: 'OFFLINE_MANAGER',
                        amount: { fact: 1500, prognose: null },
                        appliedPercent: undefined,
                        sources: [],
                    },
                ],
                salesPerformance: [],
                isPlanApproved: true,
                accrualStatus: null,
            });
            expect(findShopByEmployee).not.toHaveBeenCalled();
            expect(upsertCache).not.toHaveBeenCalled();
        });

        it('без снапшота (сотрудник без схемы на момент закрытия) отдаёт нулевой закрытый отчёт', async () => {
            const closedShopPeriod = withRequestContext(() => {
                const period = ShopAccountingPeriod.openFor('2026-07');
                period.close(1, 0);
                return period;
            });
            const { service } = buildService({
                shopAccountingPeriod: closedShopPeriod,
                shopSnapshot: null,
            });

            const report = await service.execute(999, '2026-07');

            expect(report.isClosed).toBe(true);
            expect(report.total).toEqual({ fact: 0, prognose: null });
            expect(report.rules).toEqual([]);
        });
    });

    // Режим расчёта FACT | PROGNOSE (FloatPercent, ProductSold) и
    // компактный блок salesPerformance/isPlanApproved в ответе — зеркало
    // регрессии OrderPayedEntity направления service, но через
    // ProductSoldEntity магазина (роль ONLINE_MANAGER, уровень отгрузки).
    describe('режим расчёта FACT | PROGNOSE (FloatPercent) и salesPerformance', () => {
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
                const rule = ProductSoldEntity.create({
                    type: 'ProductSold',
                    name: 'Процент от выручки по плану',
                    targetRole: 'ONLINE_MANAGER',
                    config: {
                        category: null,
                        award: {
                            type: 'FloatPercent',
                            basePercent: 10,
                            salaryBasis: 'REVENUE',
                            percentBorders: borders,
                        },
                    },
                });
                return ShopMotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 42,
                    name: 'Менеджер на проценте',
                    rules: [rule],
                });
            });

        const productSoldItem = {
            positionId: 'p1',
            demandId: 'd1',
            itemName: 'Товар p1',
            demandLabel: 'd1-label',
            folderId: null,
            quantity: 1,
            sum: 1000,
            profit: 1000,
            onlineManagerId: '999',
            offlineManagerId: null,
            onlinePurchaserId: null,
            offlinePurchaserId: null,
        };

        const identities = [
            {
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: '999',
            },
        ];

        const fakeShopPerformance = (
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

        it('прогнозный процент в другом пороге меняет прогнозную сумму относительно факта', async () => {
            const shopSchema = buildFloatPercentSchema();
            // Факт — 65% (порог 50%, множитель 0.5) -> 1000*10%*0.5 = 50.
            // Прогноз — 70% (порог 70%, множитель 1) -> 1000*10%*1 = 100.
            const { service } = buildService({
                shopSchema,
                shopErpData: {
                    hoursWorked: { fact: 0, prognose: 0 },
                    productSoldItems: [productSoldItem],
                },
                shopIdentities: identities,
                shopSalesPerformanceDetail: fakeShopPerformance(65, 70),
            });

            const report = await service.execute(42, '2026-08');
            const [rule] = report.rules;

            expect(rule.amount.fact).toBe(50);
            expect(rule.amount.prognose).toBe(100);
            expect(report.total).toEqual({ fact: 50, prognose: 100 });
        });

        it('заполняет salesPerformance и isPlanApproved по плану APPROVED', async () => {
            const shopSchema = buildFloatPercentSchema();
            const { service } = buildService({
                shopSchema,
                shopErpData: {
                    hoursWorked: { fact: 0, prognose: 0 },
                    productSoldItems: [productSoldItem],
                },
                shopIdentities: identities,
                shopSalesPerformanceDetail: fakeShopPerformance(65, 70),
            });

            const report = await service.execute(42, '2026-08');

            expect(report.salesPerformance).toEqual([
                {
                    department: 1,
                    category: null,
                    plan: { turnover: 0, margin: 0 },
                    fact: { turnover: 0, margin: 0 },
                    prognose: { turnover: 0, margin: 0 },
                    percentCompletion: 65,
                },
            ]);
            expect(report.isPlanApproved).toBe(true);
        });
    });

    // PRD 1 docs/payroll-closing-and-accrual: отчёт за закрытый период
    // дополняется статусом документа начисления сотрудника.
    it('за закрытый период отдаёт статус документа начисления сотрудника', async () => {
        const closedPeriod = withRequestContext(() => {
            const period = ShopAccountingPeriod.openFor('2026-07');
            period.close(1, 1);
            return period;
        });
        const { service, findAccrualStatus } = buildService({
            shopAccountingPeriod: closedPeriod,
            accrualStatus: 'DRAFT',
        });

        const report = await service.execute(42, '2026-07');

        expect(findAccrualStatus).toHaveBeenCalledWith('2026-07', 42);
        expect(report.isClosed).toBe(true);
        expect(report.accrualStatus).toBe('DRAFT');
    });
});
