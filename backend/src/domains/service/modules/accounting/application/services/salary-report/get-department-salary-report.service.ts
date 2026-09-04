import { Inject, Injectable } from '@nestjs/common';
import type {
    DepartmentSalaryReportResponse,
    EmployeeSalaryReportRule,
} from 'ireports-contracts';
import type { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import { toSalesPerformanceContext } from '@/domains/service/modules/accounting/application/mappers/salary-report/to-sales-performance-context';
import { buildSalaryReportRules } from '@/domains/service/modules/accounting/application/mappers/salary-report/to-salary-report-rules';
import { AccountingCacheFreshness } from '@/domains/service/modules/accounting/domain/services/accounting-cache-freshness';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { Period } from '@/shared/domain/period.value-object';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
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

// Вклад направления service в отчёт по одному сотруднику — building block,
// который combine-шаг в execute() сводит в employees[] (см. ниже). Раньше
// (до отказа от кросс-доменного отчёта) существовал такой же вклад для
// shop — удалён вместе с ним, отчёт отдела теперь строго однонаправленный.
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

// GET /v1/service/accounting/salary_report/department/:id/:period (Фаза 9)
// — тот же расчёт, что и у отчёта сотрудника (PeriodCalculationOrchestrator
// + rule.calculate()), агрегированный по всем сотрудникам отдела — без
// отдельной "свёрнутой" логики расчёта.
//
// Отчёт строго однонаправленный (только service) — кросс-доменное сведение
// с shop (было в Фазе 13.5, решение #3: employees[].rules объединял строки
// ОБОИХ направлений одним списком, а isClosed был true только при закрытии
// обоих сразу) удалено: отчёт отдела магазина обслуживается отдельным
// эндпоинтом домена shop, а не параметром/веткой этого сервиса (см.
// backend/CLAUDE.md, "зеркальные, но независимые" модули доменов).
//
// Единственное отличие от GetEmployeeSalaryReportService — сборка контекста
// расчёта идёт ОДИН РАЗ на отдел, а не на каждого сотрудника (см. PRD:
// "контекст ERP-данных должен собираться один раз на отдел ... чтобы не
// было N+1 запросов"): erpData (period-wide и так не зависит от сотрудника),
// SalesPerformance, зарплатные правила, идентичности и часы читаются одним
// батч-запросом на весь отдел (ServiceCalculationDataPort/
// ResolveEmployeeSalaryRulesService.forDepartment), а не по одному на
// сотрудника.
//
// Ленивый кэш — тот же ACCOUNTING_CALCULATION_CACHE, тот же ключ
// (direction, period, employeeId), что и у отчёта сотрудника, — расчёт по
// сотруднику из отдела и расчёт того же сотрудника через персональный
// эндпоинт используют одну и ту же кэш-строку и инвалидируются одними и
// теми же событиями (см. accounting-cache-freshness.ts).
@Injectable()
export class GetDepartmentSalaryReportService {
    constructor(
        @Inject(SERVICE_CALCULATION_DATA)
        private readonly dataSource: ServiceCalculationDataPort,
        @Inject(SALES_PERFORMANCE_READER)
        private readonly salesPerformanceReader: SalesPerformanceReaderPort,
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
        private readonly salaryRulesResolver: ResolveEmployeeSalaryRulesService,
    ) {}

    async execute(
        departmentId: number,
        period: string,
    ): Promise<DepartmentSalaryReportResponse> {
        const validatedPeriod = Period.create(period);
        const periodValue = validatedPeriod.getValue();

        const [serviceAccountingPeriod, employees] = await Promise.all([
            this.periodRepo.findByDirectionAndPeriod('service', periodValue),
            this.dataSource.findEmployeesInDepartment(departmentId),
        ]);

        // Период без записи в БД трактуется как OPEN (см.
        // AccountingPeriodRepositoryPort).
        const isClosed = serviceAccountingPeriod?.isClosed() ?? false;

        const contributions = isClosed
            ? await this.buildClosedContributions(periodValue, employees)
            : await this.buildOpenContributions(
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
                // Закрытый период не хранит прогноз в снапшоте (см.
                // buildClosedContributions) — итоговый prognose направления
                // намеренно null, а не равен факту.
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

    // Закрытый период читает готовый снапшот — тот же generic-порт
    // (AccountingPeriodSnapshotPort), что и у GetEmployeeSalaryReportService.
    // appliedPercent восстанавливается по наличию salaryBasis в строке
    // снапшота — та же эвристика, что и в
    // GetEmployeeSalaryReportService.buildClosedServiceDirection.
    private async buildClosedContributions(
        period: string,
        employees: { id: number; name: string }[],
    ): Promise<Map<number, DirectionContribution>> {
        const snapshots = await this.snapshotRepo.findManyByKey(
            'service',
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
                sources: line.sources.map((source) => ({
                    type: source.type,
                    id: source.id,
                    label: source.label,
                    link: source.link,
                    amount:
                        source.amount === undefined
                            ? undefined
                            : { fact: source.amount, prognose: null },
                    brand: source.brand,
                    deviceModel: source.deviceModel,
                    deviceColor: source.deviceColor,
                    malfunction: source.malfunction,
                })),
            }));
            contributions.set(employee.id, { lines, fact, prognose: 0 });
        }
        return contributions;
    }

    // Батч-проход направления service — контекст расчёта (erpData,
    // SalesPerformance, мотивационные схемы, идентичности, часы) собирается
    // один раз на весь отдел, а не по сотруднику (см. шапку файла).
    private async buildOpenContributions(
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
            salesPerformanceDetail,
            salaryRulesByEmployee,
            domainSyncAt,
            plans,
        ] = await Promise.all([
            this.dataSource.findEmployeeIdentitiesForEmployees(employeeIds),
            this.dataSource.findHoursWorkedForEmployees(employeeIds, period),
            this.dataSource.findServiceCompletedItems(from, to),
            this.dataSource.findOrderPayedItems(from, to),
            this.salesPerformanceReader.findForScope(
                'service',
                period,
                departmentId,
                null,
            ),
            // Правила ОБЕИХ схем каждого сотрудника — личной и схемы этого
            // отдела (см. ResolveEmployeeSalaryRulesService): без второй
            // половины сотрудники отдела, у которых нет личной схемы,
            // считались нулями.
            this.salaryRulesResolver.forDepartment(departmentId, employeeIds),
            this.domainSyncStatus.getLastSuccessfulSyncAt('service'),
            this.salesPlanRepo.findByDirectionAndPeriod('service', period),
        ]);

        const salesPlanAt = plans.reduce<Date | null>((latest, plan) => {
            const updatedAt = plan.getProps().updatedAt;
            return !latest || updatedAt > latest ? updatedAt : latest;
        }, null);
        const domainSyncStamp =
            AccountingCacheFreshness.dateStamp(domainSyncAt);
        const salesPlanStamp = AccountingCacheFreshness.dateStamp(salesPlanAt);

        const contributions = new Map<number, DirectionContribution>();

        for (const employee of employees) {
            const resolved = salaryRulesByEmployee.get(employee.id);
            const rules = resolved?.rules ?? [];
            const freshnessStamp = AccountingCacheFreshness.buildStamp({
                schemaVersion: resolved?.schemasVersion ?? 'none',
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
                    hoursWorked: hoursByEmployee.get(employee.id) ?? {
                        fact: 0,
                        prognose: 0,
                    },
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

    private async calculateEmployee(
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
}
