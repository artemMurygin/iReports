import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { toSalesPerformanceContext } from '@/domains/service/modules/accounting/application/mappers/to-sales-performance-context';
import {
    isSalesPerformancePlanApproved,
    toSalesPerformanceSummary,
} from '@/domains/service/modules/accounting/application/mappers/to-sales-performance-summary';
import { buildSalaryReportRules } from '@/domains/service/modules/accounting/application/mappers/to-salary-report-rules';
import {
    buildFreshnessStamp,
    stampOf,
} from '@/domains/service/modules/accounting/domain/services/accounting-cache-freshness';
import { Period } from '@/shared/domain/period.value-object';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';

// Тонкий сквозной путь Фазы 1, дополненный Фазой 6 ленивым кэшем и
// снапшотом закрытого периода, и Фазой 9 парой факт/прогноз + компактным
// блоком плана продаж (см. docs/payroll/plan-payroll-calculation.md,
// "Фаза 6" и "Фаза 9") — по прямому указанию плана логика встроена сюда же,
// а не в параллельный сервис.
//
// Закрытый период (AccountingPeriod.status === 'CLOSED') отдаётся из
// снапшота целиком, без обращения к оркестратору — снапшот прогноза не
// хранит (закрытый месяц не прогнозируется, см. PRD раздел 6), поэтому
// amount.prognose в ответе закрытого периода — null, а не равен факту (см.
// buildClosedServiceDirection ниже).
//
// Открытый период считает как и раньше (оркестратор по схеме сотрудника),
// но сперва сверяет freshnessStamp с последним сохранённым в кэше — при
// совпадении отдаёт кэш без вызова оркестратора, при расхождении
// пересчитывает и перезаписывает кэш (см. accounting-cache-freshness.ts).
// Кэш хранит только строки/итоги расчёта (CalculationLine[]) — компактный
// блок SalesPerformance для ответа при попадании в кэш подтягивается
// отдельным лёгким запросом (findSalesPerformanceForEmployee), не
// пересчитывая тяжёлые erpData-выборки.
//
// Контекст расчёта (EmployeeIdentity + erpData) собирает
// BuildServiceCalculationContextService (Фаза 7) — этот сервис больше не
// строит его напрямую. Режим FACT/PROGNOSE (Фаза 9) — единственное отличие
// между двумя проходами calculate(): в каждый передаётся один и тот же
// erpData/identities, но разный percentCompletion (см.
// to-sales-performance-context.ts).
//
// Сервис отвечает только за направление service — ответ односторонний
// (period + разбор одного направления, без directions[]/grandTotal, см.
// employeeSalaryReportResponseSchema в contracts). Аналогичный отчёт для
// направления shop — отдельный, независимый сервис в domains/shop (см.
// backend/CLAUDE.md, "зеркальные, но независимые" модули доменов); сведение
// двух направлений в один ответ, если понадобится, — забота вызывающего
// кода, а не этого сервиса.
@Injectable()
export class GetEmployeeSalaryReportService {
    constructor(
        @Inject(ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: AccountingPeriodRepositoryPort,
        @Inject(ACCOUNTING_PERIOD_SNAPSHOT)
        private readonly snapshotRepo: AccountingPeriodSnapshotPort,
        @Inject(ACCOUNTING_CALCULATION_CACHE)
        private readonly cacheRepo: AccountingCalculationCachePort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(DOMAIN_SYNC_STATUS)
        private readonly domainSyncStatus: DomainSyncStatusPort,
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: SalesPlanRepositoryPort,
        private readonly contextBuilder: BuildServiceCalculationContextService,
        private readonly salaryRulesResolver: ResolveEmployeeSalaryRulesService,
    ) {}

    async execute(
        employeeId: number,
        period: string,
    ): Promise<EmployeeSalaryReportResponse> {
        const validatedPeriod = Period.create(period);
        const periodValue = validatedPeriod.getValue();

        const serviceAccountingPeriod =
            await this.periodRepo.findByDirectionAndPeriod(
                'service',
                periodValue,
            );

        const direction = serviceAccountingPeriod?.isClosed()
            ? await this.buildClosedServiceDirection(periodValue, employeeId)
            : await this.buildOpenServiceDirection(validatedPeriod, employeeId);

        return { period: periodValue, ...direction };
    }

    private async buildClosedServiceDirection(
        period: string,
        employeeId: number,
    ): Promise<ClosedDirectionReport> {
        // Статус документа начисления сотрудника (PRD 1
        // docs/payroll-closing-and-accrual: "ожидает начисление / начислено /
        // выплачено") — вместе со снапшотом, одним Promise.all; null — в
        // снапшот сотрудник не попал и документа у него нет.
        const [snapshot, accrualStatus] = await Promise.all([
            this.snapshotRepo.findByKey('service', period, employeeId),
            this.accrualRepo.findStatusByKey('service', period, employeeId),
        ]);
        const total = snapshot?.total ?? 0;
        // Закрытый месяц прогноза не хранит (см. шапку файла) — amount.prognose
        // и итоговый prognose направления намеренно null, а не равны факту и
        // не занижены до нуля: ноль читался бы как "правило перестало
        // действовать", а не "прогноз не считается для закрытого периода"
        // (Фаза 9, см. PRD раздел 6: "У закрытого периода поля prognose не
        // заполняются").
        // appliedPercent восстанавливается по наличию salaryBasis в строке
        // снапшота — тот же признак "это процентное правило", что и у
        // isPercentAward() в to-salary-report-rules.ts (снапшот не хранит
        // award.type самого правила, только уже посчитанную строку).
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
            direction: 'service',
            isClosed: true,
            total: { fact: total, prognose: null },
            rules,
            salesPerformance: null,
            isPlanApproved: true,
            accrualStatus,
        };
    }

    private async buildOpenServiceDirection(
        validatedPeriod: Period,
        employeeId: number,
    ): Promise<OpenDirectionReport> {
        const period = validatedPeriod.getValue();
        // Правила ОБЕИХ схем сотрудника — личной и его отдела (см.
        // ResolveEmployeeSalaryRulesService): раньше здесь стоял прямой
        // findByEmployee, и сотрудник со схемой, заведённой на отдел,
        // получал пустой набор правил и нули во всём отчёте.
        const { rules, schemasVersion } =
            await this.salaryRulesResolver.forEmployee(employeeId);

        const freshnessStamp = await this.computeFreshnessStamp(
            'service',
            schemasVersion,
            period,
        );

        const cached = await this.cacheRepo.find('service', period, employeeId);
        if (cached && cached.freshnessStamp === freshnessStamp) {
            const salesPerformanceDetail =
                await this.contextBuilder.findSalesPerformanceForEmployee(
                    validatedPeriod,
                    employeeId,
                );
            return this.buildServiceDirectionResponse(
                rules,
                cached.factLines,
                cached.prognoseLines,
                salesPerformanceDetail,
            );
        }

        const baseContext = await this.contextBuilder.build(
            validatedPeriod,
            employeeId,
        );

        const [factLines, prognoseLines] = await Promise.all([
            PeriodCalculationOrchestrator.calculate(rules, {
                employee: baseContext.employee,
                period: baseContext.period,
                erpData: baseContext.erpData,
                mode: 'FACT',
                salesPerformance: toSalesPerformanceContext(
                    baseContext.salesPerformanceDetail,
                    'FACT',
                ),
            }),
            PeriodCalculationOrchestrator.calculate(rules, {
                employee: baseContext.employee,
                period: baseContext.period,
                erpData: baseContext.erpData,
                mode: 'PROGNOSE',
                salesPerformance: toSalesPerformanceContext(
                    baseContext.salesPerformanceDetail,
                    'PROGNOSE',
                ),
            }),
        ]);

        const factTotal = PeriodCalculationOrchestrator.total(factLines);
        const prognoseTotal =
            PeriodCalculationOrchestrator.total(prognoseLines);

        await this.cacheRepo.upsert('service', period, employeeId, {
            freshnessStamp,
            factLines,
            prognoseLines,
            factTotal,
            prognoseTotal,
        });

        return this.buildServiceDirectionResponse(
            rules,
            factLines,
            prognoseLines,
            baseContext.salesPerformanceDetail,
        );
    }

    private buildServiceDirectionResponse(
        rules: SalaryRule[],
        factLines: CalculationLine[],
        prognoseLines: CalculationLine[],
        salesPerformanceDetail: SalesPerformance | null,
    ): OpenDirectionReport {
        const ruleBreakdown = buildSalaryReportRules(
            rules,
            factLines,
            prognoseLines,
            salesPerformanceDetail,
        );

        const factTotal = PeriodCalculationOrchestrator.total(factLines);
        const prognoseTotal =
            PeriodCalculationOrchestrator.total(prognoseLines);

        return {
            direction: 'service',
            isClosed: false,
            total: { fact: factTotal, prognose: prognoseTotal },
            rules: ruleBreakdown,
            salesPerformance: toSalesPerformanceSummary(salesPerformanceDetail),
            isPlanApproved: isSalesPerformancePlanApproved(
                salesPerformanceDetail,
            ),
            // Документ начисления рождается только закрытием периода —
            // у открытого периода его нет.
            accrualStatus: null,
        };
    }

    // Три источника инвалидации кэша (PRD: синхронизация домена / правка
    // схемы или правила / правка или утверждение плана) свёрнуты в одну
    // строку сравнения — см. domain/services/accounting-cache-freshness.ts.
    private async computeFreshnessStamp(
        direction: AccountingDirection,
        schemasVersion: string,
        period: string,
    ): Promise<string> {
        const [domainSyncAt, plans] = await Promise.all([
            this.domainSyncStatus.getLastSuccessfulSyncAt(direction),
            this.salesPlanRepo.findByDirectionAndPeriod(direction, period),
        ]);

        const salesPlanAt = plans.reduce<Date | null>((latest, plan) => {
            const updatedAt = plan.getProps().updatedAt;
            return !latest || updatedAt > latest ? updatedAt : latest;
        }, null);

        return buildFreshnessStamp({
            motivationSchemaVersion: schemasVersion,
            domainSyncStamp: stampOf(domainSyncAt),
            salesPlanStamp: stampOf(salesPlanAt),
        });
    }
}

// Разбор одного направления ответа (без обёртки period) — своя ветка на
// закрытое/открытое направление (дискриминант isClosed), а не единый тип с
// total.prognose: number | null везде: так buildOpen/ClosedServiceDirection
// умеют сузить total.prognose до number в открытой ветке без явного
// приведения типов.
type EmployeeSalaryReportDirection = Omit<
    EmployeeSalaryReportResponse,
    'period'
>;

type ClosedDirectionReport = Omit<
    EmployeeSalaryReportDirection,
    'isClosed' | 'total'
> & {
    isClosed: true;
    total: { fact: number; prognose: null };
};

type OpenDirectionReport = Omit<
    EmployeeSalaryReportDirection,
    'isClosed' | 'total'
> & {
    isClosed: false;
    total: { fact: number; prognose: number };
};
