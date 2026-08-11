import { GetEmployeeSalaryReportService } from './get-employee-salary-report.service';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import { Period } from '@/shared/domain/period.value-object';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { OrderPayedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/order-payed.entity';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Ленивый кэш и снапшот закрытого периода (Фаза 6, см.
// docs/payroll/plan-payroll-calculation.md, "Фаза 6: Расчётный период,
// ленивый кэш и снапшоты"). Все зависимости — чистые in-memory фейки, без
// NestJS DI и без БД (тот же стиль, что и у остальных юнит-тестов accounting).
describe('GetEmployeeSalaryReportService', () => {
    // Часы (Фаза 7) приходят из BuildServiceCalculationContextService, а не
    // из config — фейк ниже всегда возвращает hoursWorked: 8, чтобы старые
    // числовые ожидания этого файла (2000 = 8ч × 250) остались верны.
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
            findByEmployees: jest.fn().mockResolvedValue([]),
            findAllEmployeeTargets: jest.fn().mockResolvedValue([]),
        };

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
        const upsertCache = jest.fn().mockResolvedValue(undefined);
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
                        hoursWorked: 8,
                    },
                    salesPerformanceDetail:
                        overrides?.salesPerformanceDetail ?? null,
                }),
            ),
            findSalesPerformanceForEmployee: jest.fn().mockResolvedValue(null),
        } as unknown as BuildServiceCalculationContextService;

        const service = new GetEmployeeSalaryReportService(
            motivationSchemaRepo,
            periodRepo,
            snapshotRepo,
            cacheRepo,
            domainSyncStatus,
            salesPlanRepo,
            contextBuilder,
        );

        return {
            service,
            findByEmployee,
            findByDirectionAndPeriodPeriod,
            findSnapshot,
            findCache,
            upsertCache,
            getLastSuccessfulSyncAt,
            findPlansByDirectionAndPeriod,
        };
    };

    const buildSalesPlan = (period: string) =>
        SalesPlan.create({
            direction: 'service',
            department: 1,
            category: null,
            period,
            turnover: 1000,
            margin: 100,
            source: 'MANUAL',
        });

    // SalesPlan.edit() не бьёт собственный updatedAt в памяти (у Entity нет
    // сеттера для него) — свежий штамп появляется только после реального
    // прохода через Prisma (@updatedAt на sales_plans, см. фикс
    // SalesPlanRepository.update() в этой же фазе) и повторного чтения из
    // БД. В юните это моделируется прямой пересборкой сущности с более
    // поздним updatedAt — тем же способом, каким SalesPlanMapper.toDomain()
    // восстанавливает сущность из строки БД.
    const withUpdatedAt = (plan: SalesPlan, updatedAt: Date): SalesPlan =>
        new SalesPlan({
            id: plan.id,
            createdAt: plan.getProps().createdAt,
            updatedAt,
            props: {
                scope: plan.getProps().scope,
                period: plan.period,
                turnover: plan.turnover,
                margin: plan.margin,
                source: plan.source,
                status: plan.status,
                approval: null,
            },
        });

    it('отклоняет период не в формате YYYY-MM', async () => {
        await withRequestContext(async () => {
            const { service } = buildService();

            await expect(service.execute(1, '2026/08')).rejects.toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('возвращает пустой отчёт, если у сотрудника нет мотивационной схемы', async () => {
        const { service, findByEmployee } = buildService();

        const report = await service.execute(1, '2026-08');

        expect(findByEmployee).toHaveBeenCalledWith(1);
        expect(report).toEqual({
            period: '2026-08',
            isClosed: false,
            directions: [
                {
                    direction: 'service',
                    total: { fact: 0, prognose: 0 },
                    rules: [],
                    salesPerformance: null,
                    isPlanApproved: true,
                },
            ],
            grandTotal: { fact: 0, prognose: 0 },
        });
    });

    it('возвращает итог и разбивку по правилам схемы для запроса с PayPerHour', async () => {
        const schema = buildSchema(42);
        const { service } = buildService({ schema });

        const report = await service.execute(42, '2026-08');

        expect(report.grandTotal).toEqual({ fact: 2000, prognose: 2000 });
        expect(report.directions).toHaveLength(1);
        const [direction] = report.directions;
        expect(direction.direction).toBe('service');
        expect(direction.total).toEqual({ fact: 2000, prognose: 2000 });
        expect(direction.rules).toHaveLength(1);
        expect(direction.rules[0]).toMatchObject({
            type: 'PayPerHour',
            name: 'Почасовая ставка',
            targetRole: 'ENGINEER',
            amount: { fact: 2000, prognose: 2000 },
        });
    });

    describe('ленивый кэш открытого периода', () => {
        it('первый запрос считает через оркестратор и записывает кэш', async () => {
            const schema = buildSchema(42);
            const { service, findCache, upsertCache } = buildService({
                schema,
            });

            await service.execute(42, '2026-08');

            expect(findCache).toHaveBeenCalledWith('service', '2026-08', 42);
            expect(upsertCache).toHaveBeenCalledTimes(1);
        });

        it('повторный запрос без синхронизации отдаётся из кэша и не пересчитывает', async () => {
            const schema = buildSchema(42);
            const { service, findCache, upsertCache } = buildService({
                schema,
            });

            const first = await service.execute(42, '2026-08');
            const cachedEntry = (upsertCache.mock.calls[0] as unknown[])[3];
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

        it('завершение синхронизации домена вызывает пересчёт', async () => {
            const schema = buildSchema(42);
            const { service, findCache, upsertCache, getLastSuccessfulSyncAt } =
                buildService({ schema });

            await service.execute(42, '2026-08');
            const cachedEntry = (upsertCache.mock.calls[0] as unknown[])[3];
            findCache.mockResolvedValue(cachedEntry);
            getLastSuccessfulSyncAt.mockResolvedValue(new Date('2026-08-05'));

            await service.execute(42, '2026-08');

            expect(upsertCache).toHaveBeenCalledTimes(2);
        });

        it('правка мотивационной схемы (новый updatedAt) вызывает пересчёт', async () => {
            const schema = buildSchema(42);
            const { service, findByEmployee, findCache, upsertCache } =
                buildService({ schema });

            await service.execute(42, '2026-08');
            const cachedEntry = (upsertCache.mock.calls[0] as unknown[])[3];
            findCache.mockResolvedValue(cachedEntry);

            // Правка схемы — новый updatedAt у того же сотрудника (см.
            // motivationSchemaVersion в accounting-cache-freshness.ts).
            const editedSchema = withRequestContext(() => {
                const rule = PayPerHoursEntity.create({
                    type: 'PayPerHour',
                    name: 'Почасовая ставка (правка)',
                    targetRole: 'ENGINEER',
                    config: { price: 300 },
                });
                return new MotivationSchema({
                    id: schema.id,
                    createdAt: schema.getProps().createdAt,
                    updatedAt: new Date(
                        schema.getProps().updatedAt.getTime() + 1000,
                    ),
                    props: {
                        target: schema.getProps().target,
                        name: schema.getProps().name,
                        rules: [rule],
                    },
                });
            });
            findByEmployee.mockResolvedValue(editedSchema);

            await service.execute(42, '2026-08');

            expect(upsertCache).toHaveBeenCalledTimes(2);
        });

        it('правка плана продаж периода (новый updatedAt после перечитывания из БД) вызывает пересчёт', async () => {
            const schema = buildSchema(42);
            const plan = buildSalesPlan('2026-08');
            const {
                service,
                findCache,
                upsertCache,
                findPlansByDirectionAndPeriod,
            } = buildService({ schema, plans: [plan] });

            await service.execute(42, '2026-08');
            const cachedEntry = (upsertCache.mock.calls[0] as unknown[])[3];
            findCache.mockResolvedValue(cachedEntry);

            const editedPlan = withUpdatedAt(
                plan,
                new Date(plan.getProps().updatedAt.getTime() + 1000),
            );
            findPlansByDirectionAndPeriod.mockResolvedValue([editedPlan]);

            await service.execute(42, '2026-08');

            expect(upsertCache).toHaveBeenCalledTimes(2);
        });
    });

    describe('закрытый период', () => {
        it('отдаётся из снапшота, минуя оркестратор, и не пишет в кэш', async () => {
            const schema = buildSchema(42);
            const closedPeriod = withRequestContext(() => {
                const period = AccountingPeriod.openFor({
                    direction: 'service',
                    period: '2026-07',
                });
                period.close(1, 1);
                return period;
            });

            const { service, findByEmployee, upsertCache } = buildService({
                schema,
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
                isClosed: true,
                directions: [
                    {
                        direction: 'service',
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
                ],
                grandTotal: { fact: 5000, prognose: null },
            });
            // Схема сотрудника даже не запрашивается — закрытый период
            // отдаётся из снапшота целиком (см. buildClosedReport).
            expect(findByEmployee).not.toHaveBeenCalled();
            expect(upsertCache).not.toHaveBeenCalled();
        });

        it('правка схемы, правила или плана после закрытия не меняет цифры закрытого месяца', async () => {
            const closedPeriod = withRequestContext(() => {
                const period = AccountingPeriod.openFor({
                    direction: 'service',
                    period: '2026-07',
                });
                period.close(1, 1);
                return period;
            });
            const snapshot = {
                employeeId: 42,
                total: 5000,
                lines: [
                    {
                        ruleId: 'r1',
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER' as const,
                        amount: 5000,
                        sources: [],
                    },
                ],
            };
            // Схема, "поменявшаяся" после закрытия (другое имя/ставка),
            // плюс изменённый план — ни то ни другое не должно попасть в
            // отчёт закрытого месяца: buildClosedReport читает только
            // снапшот и не обращается ни к schema, ни к salesPlanRepo.
            const editedSchema = buildSchema(42);
            const { service, findByEmployee, findPlansByDirectionAndPeriod } =
                buildService({
                    schema: editedSchema,
                    accountingPeriod: closedPeriod,
                    snapshot,
                    plans: [buildSalesPlan('2026-07')],
                });

            const report = await service.execute(42, '2026-07');

            expect(report.isClosed).toBe(true);
            expect(report.grandTotal).toEqual({ fact: 5000, prognose: null });
            expect(findByEmployee).not.toHaveBeenCalled();
            expect(findPlansByDirectionAndPeriod).not.toHaveBeenCalled();
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
            expect(report.grandTotal).toEqual({ fact: 0, prognose: null });
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

        it('прогнозный процент в другом пороге меняет прогнозную сумму относительно факта при неизменной базе продаж', async () => {
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
            const [rule] = report.directions[0].rules;

            expect(rule.amount.fact).toBe(50);
            expect(rule.amount.prognose).toBe(100);
            expect(rule.amount.fact).not.toBe(rule.amount.prognose);
        });

        it('прогнозный процент ниже текущего — прогнозная сумма меньше фактической', async () => {
            const schema = buildFloatPercentSchema();
            // Факт — 70% (множитель 1) -> 100. Прогноз — 50% (множитель 0.5) -> 50.
            const { service } = buildService({
                schema,
                erpData: {
                    serviceCompletedItems: [],
                    hoursWorked: 0,
                    orderPayedItems: [orderPayedItem],
                    confirmedTaskCompletions: [],
                },
                identities,
                salesPerformanceDetail: fakePerformance(70, 50),
            });

            const report = await service.execute(42, '2026-08');
            const [rule] = report.directions[0].rules;

            expect(rule.amount.fact).toBe(100);
            expect(rule.amount.prognose).toBe(50);
            expect(rule.amount.prognose).toBeLessThan(rule.amount.fact);
        });

        it('одинаковый процент факта и прогноза (нет плана до конца месяца) — суммы совпадают', async () => {
            const schema = buildFloatPercentSchema();
            const { service } = buildService({
                schema,
                erpData: {
                    serviceCompletedItems: [],
                    hoursWorked: 0,
                    orderPayedItems: [orderPayedItem],
                    confirmedTaskCompletions: [],
                },
                identities,
                salesPerformanceDetail: fakePerformance(70, 70),
            });

            const report = await service.execute(42, '2026-08');
            const [rule] = report.directions[0].rules;

            expect(rule.amount.fact).toBe(rule.amount.prognose);
        });
    });
});
