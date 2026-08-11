import { Inject, Injectable } from '@nestjs/common';
import type { DepartmentSalaryReportResponse } from 'ireports-contracts';
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

interface EmployeeCalculationResult {
    factLines: CalculationLine[];
    prognoseLines: CalculationLine[];
}

// GET /accounting/salary_report/department/:id/:period (Фаза 9, см.
// docs/payroll/plan-payroll-calculation.md, "Фаза 9: Отчёты — факт, прогноз,
// сотрудник и отдел"): тот же расчёт, что и у отчёта сотрудника
// (PeriodCalculationOrchestrator + rule.calculate()), агрегированный по всем
// сотрудникам отдела — без отдельной "свёрнутой" логики расчёта. Итог
// отдела — сумма итогов сотрудников, итог сотрудника — сумма его правил (см.
// PRD раздел 6).
//
// Единственное отличие от GetEmployeeSalaryReportService — сборка контекста
// расчёта идёт ОДИН РАЗ на отдел, а не на каждого сотрудника (см. PRD:
// "контекст ERP-данных должен собираться один раз на отдел ... чтобы не
// было N+1 запросов"): erpData (period-wide и так не зависит от сотрудника),
// SalesPerformance, мотивационные схемы, идентичности и часы читаются одним
// батч-запросом на весь отдел (см. ServiceCalculationDataPort.find*ForEmployees/
// MotivationSchemaRepositoryPort.findByEmployees), а не по одному на
// сотрудника.
//
// Ленивый кэш — тот же ACCOUNTING_CALCULATION_CACHE, тот же ключ
// (direction, period, employeeId), что и у отчёта сотрудника: расчёт по
// сотруднику из отдела и расчёт того же сотрудника через персональный
// эндпоинт используют одну и ту же кэш-строку и инвалидируются одними и
// теми же событиями (см. accounting-cache-freshness.ts).
@Injectable()
export class GetDepartmentSalaryReportService {
    private readonly direction: AccountingDirection = 'service';

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
    ) {}

    async execute(
        departmentId: number,
        period: string,
    ): Promise<DepartmentSalaryReportResponse> {
        const validatedPeriod = Period.create(period);
        const periodValue = validatedPeriod.getValue();

        const [accountingPeriod, employees] = await Promise.all([
            this.periodRepo.findByDirectionAndPeriod(
                this.direction,
                periodValue,
            ),
            this.dataSource.findEmployeesInDepartment(departmentId),
        ]);

        if (accountingPeriod?.isClosed()) {
            return this.buildClosedReport(periodValue, departmentId, employees);
        }

        return this.buildOpenReport(validatedPeriod, departmentId, employees);
    }

    private async buildClosedReport(
        period: string,
        departmentId: number,
        employees: { id: number; name: string }[],
    ): Promise<DepartmentSalaryReportResponse> {
        const snapshots = await this.snapshotRepo.findManyByKey(
            this.direction,
            period,
            employees.map((employee) => employee.id),
        );

        let total = 0;
        const employeeReports = employees.map((employee) => {
            const snapshot = snapshots.get(employee.id);
            const employeeTotal = snapshot?.total ?? 0;
            total += employeeTotal;
            // appliedPercent восстанавливается по наличию salaryBasis в
            // строке снапшота — та же эвристика, что и в
            // GetEmployeeSalaryReportService.buildClosedReport.
            const rules = (snapshot?.lines ?? []).map((line) => ({
                ruleId: line.ruleId,
                type: line.type,
                name: line.name,
                targetRole: line.targetRole,
                amount: { fact: line.amount, prognose: null },
                appliedPercent: line.salaryBasis ? line.rate : undefined,
                sources: line.sources,
            }));
            return {
                employeeId: employee.id,
                name: employee.name,
                total: { fact: employeeTotal, prognose: null },
                rules,
            };
        });

        return {
            period,
            isClosed: true,
            department: departmentId,
            employees: employeeReports,
            total: { fact: total, prognose: null },
        };
    }

    private async buildOpenReport(
        validatedPeriod: Period,
        departmentId: number,
        employees: { id: number; name: string }[],
    ): Promise<DepartmentSalaryReportResponse> {
        const period = validatedPeriod.getValue();
        const { from, to } = validatedPeriod.getBounds();
        const employeeIds = employees.map((employee) => employee.id);

        // Единый батч-заход на весь отдел (Фаза 9, "не должно быть N+1"):
        // erpData/SalesPerformance/схемы/идентичности/часы читаются ровно
        // один раз, независимо от числа сотрудников.
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
            this.domainSyncStatus.getLastSuccessfulSyncAt(this.direction),
            this.salesPlanRepo.findByDirectionAndPeriod(this.direction, period),
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

        let totalFact = 0;
        let totalPrognose = 0;
        const employeeReports: DepartmentSalaryReportResponse['employees'] = [];

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
                    direction: this.direction,
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

            const { factLines, prognoseLines } = await this.calculateEmployee(
                employee.id,
                period,
                freshnessStamp,
                rules,
                employeeContext,
                salesPerformanceDetail,
            );

            const employeeFact = PeriodCalculationOrchestrator.total(factLines);
            const employeePrognose =
                PeriodCalculationOrchestrator.total(prognoseLines);
            totalFact += employeeFact;
            totalPrognose += employeePrognose;

            employeeReports.push({
                employeeId: employee.id,
                name: employee.name,
                total: { fact: employeeFact, prognose: employeePrognose },
                rules: buildSalaryReportRules(
                    rules,
                    factLines,
                    prognoseLines,
                    salesPerformanceDetail,
                ),
            });
        }

        return {
            period,
            isClosed: false,
            department: departmentId,
            employees: employeeReports,
            total: { fact: totalFact, prognose: totalPrognose },
        };
    }

    private async calculateEmployee(
        employeeId: number,
        period: string,
        freshnessStamp: string,
        rules: SalaryRule[],
        baseContext: Omit<CalculationContext, 'mode' | 'salesPerformance'>,
        salesPerformanceDetail: SalesPerformance | null,
    ): Promise<EmployeeCalculationResult> {
        const cached = await this.cacheRepo.find(
            this.direction,
            period,
            employeeId,
        );
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

        await this.cacheRepo.upsert(this.direction, period, employeeId, {
            freshnessStamp,
            factLines,
            prognoseLines,
            factTotal: PeriodCalculationOrchestrator.total(factLines),
            prognoseTotal: PeriodCalculationOrchestrator.total(prognoseLines),
        });

        return { factLines, prognoseLines };
    }
}
