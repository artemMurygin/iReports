import { GetEmployeeSalaryReportService } from './get-employee-salary-report.service';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type {
    AccountingCalculationCacheEntry,
    AccountingCalculationCachePort,
} from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { Period } from '@/shared/domain/period.value-object';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { OrderPayedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/order-payed.entity';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/shop-calculation-data.types';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Direction-aware отчёт сотрудника (Фаза 13.5, см.
// docs/payroll/phase-13.5-shop-report-integration.md) — сервис всегда
// строит ОБА направления (service/shop) параллельно и независимо (свой
// AccountingPeriod, своя мотивационная схема, свой кэш/снапшот на каждое
// направление), сводя их в единый grandTotal. Все зависимости — чистые
// in-memory фейки, без NestJS DI и без БД (тот же стиль, что и у остальных
// юнит-тестов accounting).
describe('GetEmployeeSalaryReportService', () => {
    // Часы (Фаза 7) приходят из Build*CalculationContextService, а не из
    // config — фейки ниже всегда возвращают hoursWorked: 8, чтобы старые
    // числовые ожидания этого файла (2000 = 8ч × 250 у service, 800 = 8ч ×
    // 100 у shop) остались верны.
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
        schema?: MotivationSchema | null;
        shopSchema?: ShopMotivationSchema | null;
        accountingPeriod?: AccountingPeriod | null;
        shopAccountingPeriod?: AccountingPeriod | null;
        snapshot?: Awaited<
            ReturnType<AccountingPeriodSnapshotPort['findByKey']>
        >;
        shopSnapshot?: Awaited<
            ReturnType<AccountingPeriodSnapshotPort['findByKey']>
        >;
        domainSyncAt?: Date | null;
        shopDomainSyncAt?: Date | null;
        plans?: SalesPlan[];
        shopPlans?: SalesPlan[];
        erpData?: Partial<ServiceCalculationErpData>;
        shopErpData?: Partial<ShopCalculationErpData>;
        salesPerformanceDetail?: unknown;
        shopSalesPerformanceDetail?: unknown;
        identities?: {
            system: string;
            identifierType: string;
            externalId: string;
        }[];
        shopIdentities?: {
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
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
        };

        const findShopByEmployee = jest
            .fn<Promise<ShopMotivationSchema | null>, [number]>()
            .mockResolvedValue(overrides?.shopSchema ?? null);
        const shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
            insert: jest.fn(),
            findByEmployee: findShopByEmployee,
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
            findIdByTarget: jest.fn().mockResolvedValue(null),
        };

        const findByDirectionAndPeriodPeriod = jest
            .fn<Promise<AccountingPeriod | null>, [string, string]>()
            .mockImplementation((direction) =>
                Promise.resolve(
                    direction === 'shop'
                        ? (overrides?.shopAccountingPeriod ?? null)
                        : (overrides?.accountingPeriod ?? null),
                ),
            );
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: findByDirectionAndPeriodPeriod,
            save: jest.fn(),
        };

        const findSnapshot = jest
            .fn()
            .mockImplementation((direction: string) =>
                Promise.resolve(
                    direction === 'shop'
                        ? (overrides?.shopSnapshot ?? null)
                        : (overrides?.snapshot ?? null),
                ),
            );
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
            .mockImplementation((direction) =>
                Promise.resolve(
                    direction === 'shop'
                        ? (overrides?.shopDomainSyncAt ?? null)
                        : (overrides?.domainSyncAt ?? null),
                ),
            );
        const domainSyncStatus: DomainSyncStatusPort = {
            getLastSuccessfulSyncAt,
            markSuccessful: jest.fn(),
        };

        const findPlansByDirectionAndPeriod = jest
            .fn<Promise<SalesPlan[]>, [string, string]>()
            .mockImplementation((direction) =>
                Promise.resolve(
                    direction === 'shop'
                        ? (overrides?.shopPlans ?? [])
                        : (overrides?.plans ?? []),
                ),
            );
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
                        hoursWorked: 8,
                    },
                    salesPerformanceDetail:
                        overrides?.salesPerformanceDetail ?? null,
                }),
            ),
            findSalesPerformanceForEmployee: jest.fn().mockResolvedValue(null),
        } as unknown as BuildServiceCalculationContextService;

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
                        hoursWorked: 8,
                    },
                    salesPerformanceDetail:
                        overrides?.shopSalesPerformanceDetail ?? null,
                }),
            ),
            findSalesPerformanceForEmployee: jest.fn().mockResolvedValue(null),
        } as unknown as BuildShopCalculationContextService;

        const service = new GetEmployeeSalaryReportService(
            motivationSchemaRepo,
            periodRepo,
            snapshotRepo,
            cacheRepo,
            domainSyncStatus,
            salesPlanRepo,
            contextBuilder,
            shopMotivationSchemaRepo,
            shopContextBuilder,
        );

        return {
            service,
            findByEmployee,
            findShopByEmployee,
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

    it('оба направления без мотивационной схемы — пустой отчёт по обоим', async () => {
        const { service, findByEmployee, findShopByEmployee } = buildService();

        const report = await service.execute(1, '2026-08');

        expect(findByEmployee).toHaveBeenCalledWith(1);
        expect(findShopByEmployee).toHaveBeenCalledWith(1);
        expect(report).toEqual({
            period: '2026-08',
            directions: [
                {
                    direction: 'service',
                    isClosed: false,
                    total: { fact: 0, prognose: 0 },
                    rules: [],
                    salesPerformance: null,
                    isPlanApproved: true,
                },
                {
                    direction: 'shop',
                    isClosed: false,
                    total: { fact: 0, prognose: 0 },
                    rules: [],
                    salesPerformance: null,
                    isPlanApproved: true,
                },
            ],
            grandTotal: { fact: 0, prognose: 0 },
        });
    });

    describe('мотивационная схема только в одном направлении', () => {
        it('только у service — shop возвращает нулевое направление, grandTotal равен service', async () => {
            const schema = buildSchema(42);
            const { service } = buildService({ schema });

            const report = await service.execute(42, '2026-08');

            expect(report.directions).toHaveLength(2);
            const [serviceDirection, shopDirection] = report.directions;
            expect(serviceDirection.direction).toBe('service');
            expect(serviceDirection.total).toEqual({
                fact: 2000,
                prognose: 2000,
            });
            expect(shopDirection.direction).toBe('shop');
            expect(shopDirection.total).toEqual({ fact: 0, prognose: 0 });
            expect(shopDirection.rules).toEqual([]);
            expect(report.grandTotal).toEqual({ fact: 2000, prognose: 2000 });
        });

        it('только у shop — service возвращает нулевое направление, grandTotal равен shop', async () => {
            const shopSchema = buildShopSchema(42);
            const { service } = buildService({ shopSchema });

            const report = await service.execute(42, '2026-08');

            const [serviceDirection, shopDirection] = report.directions;
            expect(serviceDirection.total).toEqual({ fact: 0, prognose: 0 });
            expect(serviceDirection.rules).toEqual([]);
            expect(shopDirection.total).toEqual({ fact: 800, prognose: 800 });
            expect(report.grandTotal).toEqual({ fact: 800, prognose: 800 });
        });
    });

    it('мотивационные схемы в обоих направлениях — grandTotal суммирует оба направления', async () => {
        const schema = buildSchema(42);
        const shopSchema = buildShopSchema(42);
        const { service } = buildService({ schema, shopSchema });

        const report = await service.execute(42, '2026-08');

        const [serviceDirection, shopDirection] = report.directions;
        expect(serviceDirection.total).toEqual({ fact: 2000, prognose: 2000 });
        expect(shopDirection.total).toEqual({ fact: 800, prognose: 800 });
        // 2000 + 800 = 2800 по факту и по прогнозу (оба направления открыты).
        expect(report.grandTotal).toEqual({ fact: 2800, prognose: 2800 });
    });

    describe('ленивый кэш открытого периода — своя строка на каждое направление', () => {
        it('первый запрос считает через оба оркестратора и пишет кэш дважды (по направлению)', async () => {
            const schema = buildSchema(42);
            const shopSchema = buildShopSchema(42);
            const { service, findCache, upsertCache } = buildService({
                schema,
                shopSchema,
            });

            await service.execute(42, '2026-08');

            expect(findCache).toHaveBeenCalledWith('service', '2026-08', 42);
            expect(findCache).toHaveBeenCalledWith('shop', '2026-08', 42);
            expect(upsertCache).toHaveBeenCalledTimes(2);
            const directionsUpserted = upsertCache.mock.calls.map(
                (call) => call[0],
            );
            expect(directionsUpserted.sort()).toEqual(['service', 'shop']);
        });

        it('повторный запрос без изменений отдаётся из кэша по обоим направлениям и не пересчитывает', async () => {
            const schema = buildSchema(42);
            const shopSchema = buildShopSchema(42);
            const { service, findCache, upsertCache } = buildService({
                schema,
                shopSchema,
            });

            const first = await service.execute(42, '2026-08');
            const cachedByDirection = new Map(
                upsertCache.mock.calls.map((call) => [call[0], call[3]]),
            );
            findCache.mockImplementation((direction: string) =>
                Promise.resolve(cachedByDirection.get(direction) ?? null),
            );

            const calculateSpy = jest.spyOn(
                schema.getProps().rules[0],
                'calculate',
            );
            const shopCalculateSpy = jest.spyOn(
                shopSchema.getProps().rules[0],
                'calculate',
            );
            const second = await service.execute(42, '2026-08');

            expect(calculateSpy).not.toHaveBeenCalled();
            expect(shopCalculateSpy).not.toHaveBeenCalled();
            expect(upsertCache).toHaveBeenCalledTimes(2); // не перезаписаны второй раз
            expect(second).toEqual(first);
        });
    });

    describe('закрытый период', () => {
        it('оба направления закрыты — отчёт строится из обоих снапшотов, кэш и схемы не трогаются', async () => {
            const closedPeriod = withRequestContext(() => {
                const period = AccountingPeriod.openFor({
                    direction: 'service',
                    period: '2026-07',
                });
                period.close(1, 1);
                return period;
            });
            const closedShopPeriod = withRequestContext(() => {
                const period = AccountingPeriod.openFor({
                    direction: 'shop',
                    period: '2026-07',
                });
                period.close(1, 1);
                return period;
            });

            const { service, findByEmployee, findShopByEmployee, upsertCache } =
                buildService({
                    accountingPeriod: closedPeriod,
                    shopAccountingPeriod: closedShopPeriod,
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
                directions: [
                    {
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
                        salesPerformance: null,
                        isPlanApproved: true,
                    },
                    {
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
                        salesPerformance: null,
                        isPlanApproved: true,
                    },
                ],
                // Оба направления закрыты — prognose = fact по каждому
                // (Решение №2 плана), grandTotal.fact = 5000 + 1500 = 6500.
                grandTotal: { fact: 6500, prognose: 6500 },
            });
            expect(findByEmployee).not.toHaveBeenCalled();
            expect(findShopByEmployee).not.toHaveBeenCalled();
            expect(upsertCache).not.toHaveBeenCalled();
        });

        it('смешанный период: service закрыт, shop открыт — grandTotal.prognose берёт fact закрытого и prognose открытого', async () => {
            const closedPeriod = withRequestContext(() => {
                const period = AccountingPeriod.openFor({
                    direction: 'service',
                    period: '2026-07',
                });
                period.close(1, 1);
                return period;
            });
            const shopSchema = buildShopSchema(42);

            const { service } = buildService({
                accountingPeriod: closedPeriod,
                shopAccountingPeriod: null, // shop за этот период не закрыт
                shopSchema,
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

            const [serviceDirection, shopDirection] = report.directions;
            expect(serviceDirection.isClosed).toBe(true);
            expect(serviceDirection.total).toEqual({
                fact: 5000,
                prognose: null,
            });
            expect(shopDirection.isClosed).toBe(false);
            expect(shopDirection.total).toEqual({ fact: 800, prognose: 800 });
            // Закрытое service считает как fact (5000), открытое shop — как
            // свой prognose (800): 5000 + 800 = 5800.
            expect(report.grandTotal).toEqual({ fact: 5800, prognose: 5800 });
        });

        it('без снапшота (сотрудник без схемы на момент закрытия) отдаёт нулевой закрытый отчёт по направлению', async () => {
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

            const [serviceDirection] = report.directions;
            expect(serviceDirection.isClosed).toBe(true);
            expect(serviceDirection.total).toEqual({ fact: 0, prognose: null });
        });
    });

    // Режим расчёта FACT | PROGNOSE (Фаза 9, issue #42/#46): один и тот же
    // OrderPayedEntity.calculate() вызывается дважды с разным входным
    // percentCompletion (факт/прогноз отдела), база продаж сотрудника
    // (orderPayedItems) не меняется между проходами. Регрессия направления
    // service — направление shop в этих тестах остаётся пустым (нет схемы),
    // не влияет на прогноз/факт service, только на состав directions[].
    describe('режим расчёта FACT | PROGNOSE (FloatPercent, направление service)', () => {
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
            createdById: 7,
            closedById: null,
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

        it('прогнозный процент в другом пороге меняет прогнозную сумму направления service относительно факта', async () => {
            const schema = buildFloatPercentSchema();
            // Факт — 65% (порог 50%, множитель 0.5) -> 1000*10%*0.5 = 50.
            // Прогноз — 70% (порог 70%, множитель 1) -> 1000*10%*1 = 100.
            const { service } = buildService({
                schema,
                erpData: {
                    serviceCompletedItems: [],
                    hoursWorked: 0,
                    orderPayedItems: [orderPayedItem],
                    confirmedTaskCompletions: [],
                },
                identities,
                salesPerformanceDetail: fakePerformance(65, 70),
            });

            const report = await service.execute(42, '2026-08');
            const [serviceDirection, shopDirection] = report.directions;
            const [rule] = serviceDirection.rules;

            expect(rule.amount.fact).toBe(50);
            expect(rule.amount.prognose).toBe(100);
            expect(rule.amount.fact).not.toBe(rule.amount.prognose);
            expect(shopDirection.total).toEqual({ fact: 0, prognose: 0 });
            expect(report.grandTotal).toEqual({ fact: 50, prognose: 100 });
        });
    });
});
