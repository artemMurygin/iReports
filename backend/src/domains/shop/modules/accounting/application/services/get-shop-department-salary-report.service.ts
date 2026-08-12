import { Inject, Injectable } from '@nestjs/common';
import type {
    DepartmentSalaryReportResponse,
    EmployeeSalaryReportRule,
} from 'ireports-contracts';
import type { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { Period } from '@/shared/domain/period.value-object';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import {
    buildFreshnessStamp,
    motivationSchemaVersion,
    stampOf,
} from '@/domains/service/modules/accounting/domain/services/accounting-cache-freshness';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
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

// Вклад направления shop в отчёт по одному сотруднику — тот же
// building block, что DirectionContribution у
// GetDepartmentSalaryReportService, но без второго (service) направления:
// здесь его просто нечем комбинировать.
interface ShopContribution {
    lines: EmployeeSalaryReportRule[];
    fact: number;
    prognose: number;
}

const EMPTY_CONTRIBUTION: ShopContribution = {
    lines: [],
    fact: 0,
    prognose: 0,
};

// GET /v1/shop/accounting/salary_report/department/:id/:period — отчёт по
// зарплатам отдела, ограниченный ОДНИМ направлением shop (в отличие от
// GetDepartmentSalaryReportService домена service, который сводит service
// и shop в один плоский employees[].rules с комбинированным isClosed, см.
// docs/payroll/phase-13.5-shop-report-integration.md, решение #3). Здесь
// isClosed — статус закрытия периода направления shop как есть, без
// combine-шага по двум направлениям: сервисный отчёт остаётся
// единственной точкой, где нужен объединённый вид "сотрудник в обеих ERP
// сразу"; этот отчёт — для сценариев, которым нужен только магазин.
//
// Расчёт — тот же PeriodCalculationOrchestrator + rule.calculate(), что и у
// GetDepartmentSalaryReportService/GetEmployeeSalaryReportService, контекст
// (erpData, SalesPerformance, мотивационные схемы, идентичности, часы)
// собирается один раз на отдел, а не на каждого сотрудника — то же
// требование "без N+1", что и у зеркального сервисного отчёта. Канонический
// список сотрудников отдела здесь — ShopCalculationDataPort.
// findEmployeesInDepartment (а не ServiceCalculationDataPort, как у
// комбинированного отчёта) — единственный источник, уместный для отчёта,
// который не касается направления service вообще.
//
// Ленивый кэш — тот же ACCOUNTING_CALCULATION_CACHE, тот же ключ
// ('shop', period, employeeId), что и у GetDepartmentSalaryReportService/
// GetEmployeeSalaryReportService — расчёт по сотруднику через этот отчёт и
// через любой другой вход используют одну и ту же кэш-строку.
@Injectable()
export class GetShopDepartmentSalaryReportService {
    constructor(
        @Inject(SHOP_CALCULATION_DATA)
        private readonly shopDataSource: ShopCalculationDataPort,
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(SHOP_SALES_PERFORMANCE_READER)
        private readonly shopSalesPerformanceReader: ShopSalesPerformanceReaderPort,
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
    ) {}

    async execute(
        departmentId: number,
        period: string,
    ): Promise<DepartmentSalaryReportResponse> {
        const validatedPeriod = Period.create(period);
        const periodValue = validatedPeriod.getValue();

        const [shopAccountingPeriod, employees] = await Promise.all([
            this.periodRepo.findByDirectionAndPeriod('shop', periodValue),
            this.shopDataSource.findEmployeesInDepartment(departmentId),
        ]);

        // Период без записи в БД трактуется как OPEN (см.
        // AccountingPeriodRepositoryPort).
        const isClosed = shopAccountingPeriod?.isClosed() ?? false;

        const contributions = isClosed
            ? await this.buildClosedContributions(periodValue, employees)
            : await this.buildOpenShopContributions(
                  validatedPeriod,
                  departmentId,
                  employees,
              );

        let totalFact = 0;
        let totalPrognose = 0;
        const employeeReports: DepartmentSalaryReportResponse['employees'] =
            employees.map((employee) => {
                const contribution =
                    contributions.get(employee.id) ?? EMPTY_CONTRIBUTION;

                const fact = contribution.fact;
                // Закрытый период не хранит prognose снапшота (см.
                // buildClosedContributions) — поле null, как и у
                // GetEmployeeSalaryReportService/
                // GetDepartmentSalaryReportService закрытого направления.
                const prognose = isClosed ? null : contribution.prognose;

                totalFact += fact;
                if (prognose !== null) {
                    totalPrognose += prognose;
                }

                return {
                    employeeId: employee.id,
                    name: employee.name,
                    total: { fact, prognose },
                    rules: contribution.lines,
                };
            });

        return {
            period: periodValue,
            isClosed,
            department: departmentId,
            employees: employeeReports,
            total: {
                fact: totalFact,
                prognose: isClosed ? null : totalPrognose,
            },
        };
    }

    // Закрытый период читает готовый снапшот направления shop — тот же
    // generic AccountingPeriodSnapshotPort, что и у
    // GetDepartmentSalaryReportService.buildClosedContributions, здесь
    // жёстко под direction 'shop'. appliedPercent восстанавливается по
    // наличию salaryBasis в строке снапшота — та же эвристика, что и в
    // GetEmployeeSalaryReportService.buildClosedReport.
    private async buildClosedContributions(
        period: string,
        employees: { id: number; name: string }[],
    ): Promise<Map<number, ShopContribution>> {
        const snapshots = await this.snapshotRepo.findManyByKey(
            'shop',
            period,
            employees.map((employee) => employee.id),
        );

        const contributions = new Map<number, ShopContribution>();
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

    // Батч-проход направления shop — почти дословно
    // GetDepartmentSalaryReportService.buildOpenShopContributions, но
    // отдаёт Map, которую execute() читает напрямую (нечего комбинировать
    // со вторым направлением). categoryDescendantFolderIds раскрывается
    // ОДИН раз на весь отдел, по объединению category всех схем сотрудников
    // отдела (не по одной схеме за раз, как в
    // BuildShopCalculationContextService — там раскрытие делается на одного
    // сотрудника).
    private async buildOpenShopContributions(
        validatedPeriod: Period,
        departmentId: number,
        employees: { id: number; name: string }[],
    ): Promise<Map<number, ShopContribution>> {
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

        const contributions = new Map<number, ShopContribution>();

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
