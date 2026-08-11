import { Inject, Injectable } from '@nestjs/common';
import type {
    DepartmentSalaryReportResponse,
    EmployeeSalaryReportRule,
} from 'ireports-contracts';
import type {
    AccountingDirection,
    CalculationContext,
} from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import { toSalesPerformanceContext } from '@/domains/service/modules/accounting/application/mappers/to-sales-performance-context';
import { buildSalaryReportRules } from '@/domains/service/modules/accounting/application/mappers/to-salary-report-rules';
import {
    buildFreshnessStamp,
    motivationSchemaVersion,
    stampOf,
} from '@/domains/service/modules/accounting/domain/services/accounting-cache-freshness';
import { Period } from '@/shared/domain/period.value-object';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SALES_PERFORMANCE_READER } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/shop-calculation-data.types';
import { PeriodCalculationOrchestrator as ShopPeriodCalculationOrchestrator } from '@/domains/shop/modules/accounting/domain/services/period-calculation.orchestrator';
import { toShopSalesPerformanceContext } from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-context';
import { buildShopSalaryReportRules } from '@/domains/shop/modules/accounting/application/mappers/to-shop-salary-report-rules';
import { SHOP_SALES_PERFORMANCE_READER } from '@/domains/shop/modules/sales/application/ports/shop-sales-performance.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/shop-sales-performance.port';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/shop-sales-performance.value-object';

interface EmployeeCalculationResult {
    factLines: CalculationLine[];
    prognoseLines: CalculationLine[];
}

// Вклад одного направления в отчёт по одному сотруднику — building block,
// который combine-шаг в execute() сводит в employees[] (см. ниже).
// prognose закрытого направления не несёт смысла (снапшот прогноз не
// хранит) — combine-шаг всегда подставляет fact вместо него, поле здесь
// просто не читается в этом случае.
interface DirectionContribution {
    lines: EmployeeSalaryReportRule[];
    fact: number;
    prognose: number;
}

const EMPTY_CONTRIBUTION: DirectionContribution = {
    lines: [],
    fact: 0,
    prognose: 0,
};

// GET /accounting/salary_report/department/:id/:period (Фаза 9, дополнено
// Фазой 13.5, см. docs/payroll/phase-13.5-shop-report-integration.md,
// решение #3) — тот же расчёт, что и у отчёта сотрудника
// (PeriodCalculationOrchestrator + rule.calculate()), агрегированный по
// всем сотрудникам отдела — без отдельной "свёрнутой" логики расчёта.
//
// В отличие от GetEmployeeSalaryReportService отчёт отдела НЕ получает
// directions[]-разбивку (сознательное упрощение, решение #3):
// employees[].rules объединяет строки ОБОИХ направлений одним плоским
// списком, а верхнеуровневый isClosed — true, только если периоды закрытия
// закрыты у обоих направлений сразу. service и shop при этом закрываются
// независимо (см. AccountingPeriod), поэтому у каждого направления —
// собственный статус (serviceClosed/shopClosed) и собственный батч-проход
// (buildClosedContributions/buildOpenService.../buildOpenShop...), а
// employees[].total.prognose комбинируется по той же формуле, что и
// grandTotal сотрудника: у закрытого направления вместо prognose
// подставляется его fact (см. combine-шаг в execute()).
//
// Единственное отличие от GetEmployeeSalaryReportService — сборка контекста
// расчёта идёт ОДИН РАЗ на отдел, а не на каждого сотрудника (см. PRD:
// "контекст ERP-данных должен собираться один раз на отдел ... чтобы не
// было N+1 запросов"): erpData (period-wide и так не зависит от сотрудника),
// SalesPerformance, мотивационные схемы, идентичности и часы читаются одним
// батч-запросом на весь отдел — как для service (ServiceCalculationDataPort/
// MotivationSchemaRepositoryPort), так и для shop (ShopCalculationDataPort/
// ShopMotivationSchemaRepositoryPort), а не по одному на сотрудника.
// Канонический список сотрудников отдела — ОДИН, из
// ServiceCalculationDataPort.findEmployeesInDepartment: у shop есть
// одноимённый метод порта, но использовать его здесь означало бы второй,
// потенциально рассинхронизированный список тех же Bitrix-сотрудников.
//
// Ленивый кэш — тот же ACCOUNTING_CALCULATION_CACHE, тот же ключ
// (direction, period, employeeId), что и у отчёта сотрудника, — расчёт по
// сотруднику из отдела и расчёт того же сотрудника через персональный
// эндпоинт используют одну и ту же кэш-строку и инвалидируются одними и
// теми же событиями (см. accounting-cache-freshness.ts), независимо по
// каждому направлению.
@Injectable()
export class GetDepartmentSalaryReportService {
    constructor(
        @Inject(SERVICE_CALCULATION_DATA)
        private readonly dataSource: ServiceCalculationDataPort,
        @Inject(SALES_PERFORMANCE_READER)
        private readonly salesPerformanceReader: SalesPerformanceReaderPort,
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: AccountingPeriodRepositoryPort,
        @Inject(ACCOUNTING_PERIOD_SNAPSHOT)
        private readonly snapshotRepo: AccountingPeriodSnapshotPort,
        @Inject(ACCOUNTING_CALCULATION_CACHE)
        private readonly cacheRepo: AccountingCalculationCachePort,
        @Inject(DOMAIN_SYNC_STATUS)
        private readonly domainSyncStatus: DomainSyncStatusPort,
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: SalesPlanRepositoryPort,
        @Inject(SHOP_CALCULATION_DATA)
        private readonly shopDataSource: ShopCalculationDataPort,
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(SHOP_SALES_PERFORMANCE_READER)
        private readonly shopSalesPerformanceReader: ShopSalesPerformanceReaderPort,
    ) {}

    async execute(
        departmentId: number,
        period: string,
    ): Promise<DepartmentSalaryReportResponse> {
        const validatedPeriod = Period.create(period);
        const periodValue = validatedPeriod.getValue();

        const [serviceAccountingPeriod, shopAccountingPeriod, employees] =
            await Promise.all([
                this.periodRepo.findByDirectionAndPeriod(
                    'service',
                    periodValue,
                ),
                this.periodRepo.findByDirectionAndPeriod('shop', periodValue),
                this.dataSource.findEmployeesInDepartment(departmentId),
            ]);

        // Период без записи в БД трактуется как OPEN (см.
        // AccountingPeriodRepositoryPort) — то же правило для обоих
        // направлений независимо.
        const serviceClosed = serviceAccountingPeriod?.isClosed() ?? false;
        const shopClosed = shopAccountingPeriod?.isClosed() ?? false;
        const topIsClosed = serviceClosed && shopClosed;

        const [serviceContributions, shopContributions] = await Promise.all([
            serviceClosed
                ? this.buildClosedContributions(
                      'service',
                      periodValue,
                      employees,
                  )
                : this.buildOpenServiceContributions(
                      validatedPeriod,
                      departmentId,
                      employees,
                  ),
            shopClosed
                ? this.buildClosedContributions('shop', periodValue, employees)
                : this.buildOpenShopContributions(
                      validatedPeriod,
                      departmentId,
                      employees,
                  ),
        ]);

        let totalFact = 0;
        let totalPrognose = 0;
        const employeeReports: DepartmentSalaryReportResponse['employees'] =
            employees.map((employee) => {
                const service =
                    serviceContributions.get(employee.id) ?? EMPTY_CONTRIBUTION;
                const shop =
                    shopContributions.get(employee.id) ?? EMPTY_CONTRIBUTION;

                const fact = service.fact + shop.fact;
                // Закрытое направление в сумму prognose вносит свой fact —
                // тот же приём, что у grandTotal.prognose отчёта сотрудника
                // (решение #2): результат по нему уже финален, экстраполировать
                // больше нечего. null — только когда закрыты ОБА направления
                // сразу (топ-уровневый isClosed).
                const prognose = topIsClosed
                    ? null
                    : (serviceClosed ? service.fact : service.prognose) +
                      (shopClosed ? shop.fact : shop.prognose);

                totalFact += fact;
                if (prognose !== null) {
                    totalPrognose += prognose;
                }

                return {
                    employeeId: employee.id,
                    name: employee.name,
                    total: { fact, prognose },
                    rules: [...service.lines, ...shop.lines],
                };
            });

        return {
            period: periodValue,
            isClosed: topIsClosed,
            department: departmentId,
            employees: employeeReports,
            total: {
                fact: totalFact,
                prognose: topIsClosed ? null : totalPrognose,
            },
        };
    }

    // Закрытый период читает готовый снапшот — общий генерик-порт
    // (AccountingPeriodSnapshotPort), один и тот же для обоих направлений,
    // различающихся только ключом direction. appliedPercent
    // восстанавливается по наличию salaryBasis в строке снапшота — та же
    // эвристика, что и в GetEmployeeSalaryReportService.buildClosedReport.
    private async buildClosedContributions(
        direction: AccountingDirection,
        period: string,
        employees: { id: number; name: string }[],
    ): Promise<Map<number, DirectionContribution>> {
        const snapshots = await this.snapshotRepo.findManyByKey(
            direction,
            period,
            employees.map((employee) => employee.id),
        );

        const contributions = new Map<number, DirectionContribution>();
        for (const employee of employees) {
            const snapshot = snapshots.get(employee.id);
            const fact = snapshot?.total ?? 0;
            const lines = (snapshot?.lines ?? []).map((line) => ({
                ruleId: line.ruleId,
                type: line.type,
                name: line.name,
                targetRole: line.targetRole,
                amount: { fact: line.amount, prognose: null },
                appliedPercent: line.salaryBasis ? line.rate : undefined,
                sources: line.sources,
            }));
            contributions.set(employee.id, { lines, fact, prognose: 0 });
        }
        return contributions;
    }

    // Батч-проход направления service — почти дословно бывший
    // buildOpenReport этого файла (до Фазы 13.5), но отдаёт вклад
    // направления в Map, а не готовый employees[] отчёта: combine-шаг
    // execute() объединяет его со вкладом shop.
    private async buildOpenServiceContributions(
        validatedPeriod: Period,
        departmentId: number,
        employees: { id: number; name: string }[],
    ): Promise<Map<number, DirectionContribution>> {
        const period = validatedPeriod.getValue();
        const { from, to } = validatedPeriod.getBounds();
        const employeeIds = employees.map((employee) => employee.id);

        const [
            identitiesByEmployee,
            hoursByEmployee,
            serviceCompletedItems,
            orderPayedItems,
            confirmedTaskCompletions,
            salesPerformanceDetail,
            schemas,
            domainSyncAt,
            plans,
        ] = await Promise.all([
            this.dataSource.findEmployeeIdentitiesForEmployees(employeeIds),
            this.dataSource.findHoursWorkedForEmployees(employeeIds, period),
            this.dataSource.findServiceCompletedItems(from, to),
            this.dataSource.findOrderPayedItems(from, to),
            this.dataSource.findConfirmedTaskCompletions(period),
            this.salesPerformanceReader.findForScope(
                'service',
                period,
                departmentId,
                null,
            ),
            this.motivationSchemaRepo.findByEmployees(employeeIds),
            this.domainSyncStatus.getLastSuccessfulSyncAt('service'),
            this.salesPlanRepo.findByDirectionAndPeriod('service', period),
        ]);

        const schemaByEmployee = new Map(
            schemas.map((schema) => [schema.getProps().target.getId(), schema]),
        );
        const salesPlanAt = plans.reduce<Date | null>((latest, plan) => {
            const updatedAt = plan.getProps().updatedAt;
            return !latest || updatedAt > latest ? updatedAt : latest;
        }, null);
        const domainSyncStamp = stampOf(domainSyncAt);
        const salesPlanStamp = stampOf(salesPlanAt);

        const contributions = new Map<number, DirectionContribution>();

        for (const employee of employees) {
            const schema = schemaByEmployee.get(employee.id) ?? null;
            const rules = schema?.getProps().rules ?? [];
            const freshnessStamp = buildFreshnessStamp({
                motivationSchemaVersion: motivationSchemaVersion(schema),
                domainSyncStamp,
                salesPlanStamp,
            });

            const employeeContext = {
                employee: {
                    id: employee.id,
                    identities: identitiesByEmployee.get(employee.id) ?? [],
                },
                period: {
                    direction: 'service' as const,
                    period,
                    from,
                    to,
                    status: 'OPEN' as const,
                },
                erpData: {
                    serviceCompletedItems,
                    orderPayedItems,
                    confirmedTaskCompletions,
                    hoursWorked: hoursByEmployee.get(employee.id) ?? 0,
                } satisfies ServiceCalculationErpData,
            };

            const { factLines, prognoseLines } =
                await this.calculateServiceEmployee(
                    employee.id,
                    period,
                    freshnessStamp,
                    rules,
                    employeeContext,
                    salesPerformanceDetail,
                );

            contributions.set(employee.id, {
                fact: PeriodCalculationOrchestrator.total(factLines),
                prognose: PeriodCalculationOrchestrator.total(prognoseLines),
                lines: buildSalaryReportRules(
                    rules,
                    factLines,
                    prognoseLines,
                    salesPerformanceDetail,
                ),
            });
        }

        return contributions;
    }

    // Батч-проход направления shop (Фаза 13.5) — зеркало
    // buildOpenServiceContributions выше по структуре, но на своих
    // независимых классах (ShopPeriodCalculationOrchestrator,
    // buildShopSalaryReportRules, ShopCalculationDataPort) — см.
    // backend/CLAUDE.md, "зеркальные, но независимые" модули доменов.
    // categoryDescendantFolderIds раскрывается ОДИН раз на весь отдел, по
    // объединению category всех схем сотрудников отдела (не по одной схеме
    // за раз, как в BuildShopCalculationContextService — там раскрытие
    // делается на одного сотрудника).
    private async buildOpenShopContributions(
        validatedPeriod: Period,
        departmentId: number,
        employees: { id: number; name: string }[],
    ): Promise<Map<number, DirectionContribution>> {
        const period = validatedPeriod.getValue();
        const { from, to } = validatedPeriod.getBounds();
        const employeeIds = employees.map((employee) => employee.id);

        const [
            identitiesByEmployee,
            hoursByEmployee,
            productSoldItems,
            confirmedTaskCompletions,
            schemas,
            domainSyncAt,
            plans,
        ] = await Promise.all([
            this.shopDataSource.findEmployeeIdentitiesForEmployees(employeeIds),
            this.shopDataSource.findHoursWorkedForEmployees(
                employeeIds,
                period,
            ),
            this.shopDataSource.findProductSoldItems(from, to),
            this.shopDataSource.findConfirmedTaskCompletions(period),
            this.shopMotivationSchemaRepo.findByEmployees(employeeIds),
            this.domainSyncStatus.getLastSuccessfulSyncAt('shop'),
            this.salesPlanRepo.findByDirectionAndPeriod('shop', period),
        ]);

        const salesPerformanceDetail =
            await this.shopSalesPerformanceReader.findForScope(
                period,
                departmentId,
                null,
            );

        const schemaByEmployee = new Map(
            schemas.map((schema) => [schema.getProps().target.getId(), schema]),
        );
        const categoryDescendantFolderIds =
            await this.resolveShopCategoryDescendantFolderIds(schemas);
        const salesPlanAt = plans.reduce<Date | null>((latest, plan) => {
            const updatedAt = plan.getProps().updatedAt;
            return !latest || updatedAt > latest ? updatedAt : latest;
        }, null);
        const domainSyncStamp = stampOf(domainSyncAt);
        const salesPlanStamp = stampOf(salesPlanAt);

        const contributions = new Map<number, DirectionContribution>();

        for (const employee of employees) {
            const schema = schemaByEmployee.get(employee.id) ?? null;
            const rules = schema?.getProps().rules ?? [];
            const freshnessStamp = buildFreshnessStamp({
                motivationSchemaVersion: motivationSchemaVersion(schema),
                domainSyncStamp,
                salesPlanStamp,
            });

            const employeeContext = {
                employee: {
                    id: employee.id,
                    identities: identitiesByEmployee.get(employee.id) ?? [],
                },
                period: {
                    direction: 'shop' as const,
                    period,
                    from,
                    to,
                    status: 'OPEN' as const,
                },
                erpData: {
                    hoursWorked: hoursByEmployee.get(employee.id) ?? 0,
                    productSoldItems,
                    categoryDescendantFolderIds,
                    taskCompletions: confirmedTaskCompletions,
                } satisfies ShopCalculationErpData,
            };

            const { factLines, prognoseLines } =
                await this.calculateShopEmployee(
                    employee.id,
                    period,
                    freshnessStamp,
                    rules,
                    employeeContext,
                    salesPerformanceDetail,
                );

            contributions.set(employee.id, {
                fact: ShopPeriodCalculationOrchestrator.total(factLines),
                prognose:
                    ShopPeriodCalculationOrchestrator.total(prognoseLines),
                lines: buildShopSalaryReportRules(
                    rules,
                    factLines,
                    prognoseLines,
                    salesPerformanceDetail,
                ),
            });
        }

        return contributions;
    }

    // Уникальные category правил ProductSold/UsedProductSold ВСЕХ схем
    // отдела разом (union, issue #60/#57) — один батч-вызов
    // resolveCategoryDescendantFolderIds на отдел, а не по одному на
    // сотрудника/схему, зеркало collectCategoryIds
    // BuildShopCalculationContextService, но на весь список схем.
    private async resolveShopCategoryDescendantFolderIds(
        schemas: ShopMotivationSchema[],
    ): Promise<Record<string, string[]>> {
        const categoryIds = new Set<string>();
        for (const schema of schemas) {
            for (const rule of schema.getProps().rules) {
                if (
                    rule.type !== 'ProductSold' &&
                    rule.type !== 'UsedProductSold'
                ) {
                    continue;
                }
                if ('category' in rule.config && rule.config.category != null) {
                    categoryIds.add(rule.config.category);
                }
            }
        }
        if (categoryIds.size === 0) {
            return {};
        }
        return this.shopDataSource.resolveCategoryDescendantFolderIds([
            ...categoryIds,
        ]);
    }

    private async calculateServiceEmployee(
        employeeId: number,
        period: string,
        freshnessStamp: string,
        rules: SalaryRule[],
        baseContext: Omit<CalculationContext, 'mode' | 'salesPerformance'>,
        salesPerformanceDetail: SalesPerformance | null,
    ): Promise<EmployeeCalculationResult> {
        const cached = await this.cacheRepo.find('service', period, employeeId);
        if (cached && cached.freshnessStamp === freshnessStamp) {
            return {
                factLines: cached.factLines,
                prognoseLines: cached.prognoseLines,
            };
        }

        const [factLines, prognoseLines] = await Promise.all([
            PeriodCalculationOrchestrator.calculate(rules, {
                ...baseContext,
                mode: 'FACT',
                salesPerformance: toSalesPerformanceContext(
                    salesPerformanceDetail,
                    'FACT',
                ),
            }),
            PeriodCalculationOrchestrator.calculate(rules, {
                ...baseContext,
                mode: 'PROGNOSE',
                salesPerformance: toSalesPerformanceContext(
                    salesPerformanceDetail,
                    'PROGNOSE',
                ),
            }),
        ]);

        await this.cacheRepo.upsert('service', period, employeeId, {
            freshnessStamp,
            factLines,
            prognoseLines,
            factTotal: PeriodCalculationOrchestrator.total(factLines),
            prognoseTotal: PeriodCalculationOrchestrator.total(prognoseLines),
        });

        return { factLines, prognoseLines };
    }

    // Зеркало calculateServiceEmployee выше на направлении shop — свой
    // оркестратор/маппер режима, тот же generic ACCOUNTING_CALCULATION_CACHE
    // порт под ключом ('shop', period, employeeId).
    private async calculateShopEmployee(
        employeeId: number,
        period: string,
        freshnessStamp: string,
        rules: ShopSalaryRule[],
        baseContext: Omit<CalculationContext, 'mode' | 'salesPerformance'>,
        salesPerformanceDetail: ShopSalesPerformance | null,
    ): Promise<EmployeeCalculationResult> {
        const cached = await this.cacheRepo.find('shop', period, employeeId);
        if (cached && cached.freshnessStamp === freshnessStamp) {
            return {
                factLines: cached.factLines,
                prognoseLines: cached.prognoseLines,
            };
        }

        const [factLines, prognoseLines] = await Promise.all([
            ShopPeriodCalculationOrchestrator.calculate(rules, {
                ...baseContext,
                mode: 'FACT',
                salesPerformance: toShopSalesPerformanceContext(
                    salesPerformanceDetail,
                    'FACT',
                ),
            }),
            ShopPeriodCalculationOrchestrator.calculate(rules, {
                ...baseContext,
                mode: 'PROGNOSE',
                salesPerformance: toShopSalesPerformanceContext(
                    salesPerformanceDetail,
                    'PROGNOSE',
                ),
            }),
        ]);

        await this.cacheRepo.upsert('shop', period, employeeId, {
            freshnessStamp,
            factLines,
            prognoseLines,
            factTotal: ShopPeriodCalculationOrchestrator.total(factLines),
            prognoseTotal:
                ShopPeriodCalculationOrchestrator.total(prognoseLines),
        });

        return { factLines, prognoseLines };
    }
}
