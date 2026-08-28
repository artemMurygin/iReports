import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { CalculationLine } from '@/shared/domain/calculation-line';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { PeriodCalculationOrchestrator as ShopPeriodCalculationOrchestrator } from '@/domains/shop/modules/accounting/domain/services/period-calculation.orchestrator';
import { toShopSalesPerformanceContext } from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-context';
import {
    isShopSalesPerformancePlanApprovedList,
    toShopSalesPerformanceSummary,
} from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-summary';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/shop-sales-performance.value-object';
import type { SalesPerformanceSummary } from 'ireports-contracts';
import { buildShopSalaryReportRules } from '@/domains/shop/modules/accounting/application/mappers/to-shop-salary-report-rules';
import {
    buildFreshnessStamp,
    stampOf,
} from '@/domains/shop/modules/accounting/domain/services/shop-accounting-cache-freshness';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/resolve-shop-employee-salary-rules.service';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period.port';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period.port';
import { SHOP_ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period-snapshot.port';
import type { ShopAccountingPeriodSnapshotPort } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period-snapshot.port';
import { SHOP_ACCOUNTING_CALCULATION_CACHE } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-calculation-cache.port';
import type { ShopAccountingCalculationCachePort } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-calculation-cache.port';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SHOP_SALES_PLAN_REPOSITORY } from '@/domains/shop/modules/sales/application/ports/shop-sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/shop-sales-plan.port';

// Отчёт по зарплате сотрудника магазина (Фаза 13.5, см.
// docs/payroll/phase-13.5-shop-report-integration.md) — зеркало
// GetEmployeeSalaryReportService направления service (см.
// domains/service/CLAUDE.md, "Отчёты"), но собственный, не
// direction-aware сервис: ответ контракта односторонний (один отчёт одного
// направления, см. employeeSalaryReportResponseSchema в contracts), поэтому
// объединять два отчёта на уровне сервиса незачем — за это, если понадобится,
// отвечает вызывающий код.
//
// Закрытый период (AccountingPeriod.status === 'CLOSED') отдаётся из
// снапшота целиком, без обращения к оркестратору — снапшот прогноза не
// хранит (закрытый месяц не прогнозируется, см. PRD раздел 6), поэтому
// amount.prognose в ответе закрытого периода — null, а не равен факту (см.
// buildClosedDirection ниже).
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
// BuildShopCalculationContextService (Фаза 13.5) — этот сервис больше не
// строит его напрямую. Режим FACT/PROGNOSE — единственное отличие между
// двумя проходами calculate(): в каждый передаётся один и тот же
// erpData/identities, но разный percentCompletion (см.
// to-shop-sales-performance-context.ts).
//
// SHOP_ACCOUNTING_PERIOD_REPOSITORY/SHOP_ACCOUNTING_PERIOD_SNAPSHOT/
// SHOP_ACCOUNTING_CALCULATION_CACHE — с Фазы 5
// docs/service-shop-boundary-violations-fix собственные независимые
// классы/токены направления shop, без параметра direction: он зафиксирован
// самой реализацией (см. shop-accounting.module.ts).
@Injectable()
export class GetShopEmployeeSalaryReportService {
    constructor(
        @Inject(SHOP_ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: ShopAccountingPeriodRepositoryPort,
        @Inject(SHOP_ACCOUNTING_PERIOD_SNAPSHOT)
        private readonly snapshotRepo: ShopAccountingPeriodSnapshotPort,
        @Inject(SHOP_ACCOUNTING_CALCULATION_CACHE)
        private readonly cacheRepo: ShopAccountingCalculationCachePort,
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(DOMAIN_SYNC_STATUS)
        private readonly domainSyncStatus: DomainSyncStatusPort,
        @Inject(SHOP_SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: ShopSalesPlanRepositoryPort,
        private readonly shopContextBuilder: BuildShopCalculationContextService,
        private readonly salaryRulesResolver: ResolveShopEmployeeSalaryRulesService,
    ) {}

    async execute(
        employeeId: number,
        period: string,
    ): Promise<EmployeeSalaryReportResponse> {
        const validatedPeriod = Period.create(period);
        const periodValue = validatedPeriod.getValue();

        const accountingPeriod =
            await this.periodRepo.findByPeriod(periodValue);

        const direction = accountingPeriod?.isClosed()
            ? await this.buildClosedDirection(periodValue, employeeId)
            : await this.buildOpenDirection(validatedPeriod, employeeId);

        return { period: periodValue, ...direction };
    }

    private async buildClosedDirection(
        period: string,
        employeeId: number,
    ): Promise<ClosedDirectionReport> {
        // Статус документа начисления сотрудника (PRD 1
        // docs/payroll-closing-and-accrual: "ожидает начисление / начислено /
        // выплачено") — вместе со снапшотом, одним Promise.all; null — в
        // снапшот сотрудник не попал и документа у него нет.
        const [snapshot, accrualStatus] = await Promise.all([
            this.snapshotRepo.findByKey(period, employeeId),
            this.accrualRepo.findStatusByKey(period, employeeId),
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
        // isPercentAward() в to-shop-salary-report-rules.ts (снапшот не
        // хранит award.type самого правила, только уже посчитанную строку).
        const rules = (snapshot?.lines ?? []).map((line) => ({
            ruleId: line.ruleId,
            type: line.type,
            name: line.name,
            targetRole: line.targetRole,
            amount: { fact: line.amount, prognose: null },
            appliedPercent: line.salaryBasis ? line.rate : undefined,
            // Закрытый период не хранит прогноз (см. шапку файла) — сумма
            // источника, как и сумма строки, тоже сведена fact/prognose:null.
            // amount самого источника — undefined у снапшотов, сохранённых
            // до появления этого поля (см. calculation-line.ts).
            sources: line.sources.map((source) => ({
                type: source.type,
                id: source.id,
                label: source.label,
                link: source.link,
                amount:
                    source.amount === undefined
                        ? undefined
                        : { fact: source.amount, prognose: null },
            })),
        }));

        return {
            direction: 'shop',
            isClosed: true,
            total: { fact: total, prognose: null },
            rules,
            salesPerformance: [],
            isPlanApproved: true,
            accrualStatus,
        };
    }

    private async buildOpenDirection(
        validatedPeriod: Period,
        employeeId: number,
    ): Promise<OpenDirectionReport> {
        const period = validatedPeriod.getValue();
        // Правила ОБЕИХ схем сотрудника — личной и его отдела (см.
        // ResolveShopEmployeeSalaryRulesService): раньше здесь стоял прямой
        // findByEmployee, и сотрудник со схемой, заведённой на отдел,
        // получал пустой набор правил и нули во всём отчёте.
        const { rules, schemasVersion } =
            await this.salaryRulesResolver.forEmployee(employeeId);

        const freshnessStamp = await this.computeFreshnessStamp(
            schemasVersion,
            period,
        );

        const cached = await this.cacheRepo.find(period, employeeId);
        if (cached && cached.freshnessStamp === freshnessStamp) {
            const [salesPerformanceDetail, salesPerformanceByDepartment] =
                await Promise.all([
                    this.shopContextBuilder.findSalesPerformanceForEmployee(
                        validatedPeriod,
                        employeeId,
                    ),
                    this.shopContextBuilder.findSalesPerformanceByDepartmentForEmployee(
                        validatedPeriod,
                        employeeId,
                    ),
                ]);
            return this.buildDirectionResponse(
                rules,
                cached.factLines,
                cached.prognoseLines,
                salesPerformanceDetail,
                salesPerformanceByDepartment,
            );
        }

        const baseContext = await this.shopContextBuilder.build(
            validatedPeriod,
            employeeId,
            rules,
        );

        const [factLines, prognoseLines] = await Promise.all([
            ShopPeriodCalculationOrchestrator.calculate(rules, {
                employee: baseContext.employee,
                period: baseContext.period,
                erpData: baseContext.erpData,
                mode: 'FACT',
                salesPerformance: toShopSalesPerformanceContext(
                    baseContext.salesPerformanceByCategory,
                    'FACT',
                ),
            }),
            ShopPeriodCalculationOrchestrator.calculate(rules, {
                employee: baseContext.employee,
                period: baseContext.period,
                erpData: baseContext.erpData,
                mode: 'PROGNOSE',
                salesPerformance: toShopSalesPerformanceContext(
                    baseContext.salesPerformanceByCategory,
                    'PROGNOSE',
                ),
            }),
        ]);

        const factTotal = ShopPeriodCalculationOrchestrator.total(factLines);
        const prognoseTotal =
            ShopPeriodCalculationOrchestrator.total(prognoseLines);

        await this.cacheRepo.upsert(period, employeeId, {
            freshnessStamp,
            factLines,
            prognoseLines,
            factTotal,
            prognoseTotal,
        });

        return this.buildDirectionResponse(
            rules,
            factLines,
            prognoseLines,
            baseContext.salesPerformanceDetail,
            baseContext.salesPerformanceByDepartment,
        );
    }

    private buildDirectionResponse(
        rules: ShopSalaryRule[],
        factLines: CalculationLine[],
        prognoseLines: CalculationLine[],
        salesPerformanceDetail: Parameters<
            typeof buildShopSalaryReportRules
        >[3],
        salesPerformanceByDepartment: ShopSalesPerformance[],
    ): OpenDirectionReport {
        const ruleBreakdown = buildShopSalaryReportRules(
            rules,
            factLines,
            prognoseLines,
            salesPerformanceDetail,
        );

        const factTotal = ShopPeriodCalculationOrchestrator.total(factLines);
        const prognoseTotal =
            ShopPeriodCalculationOrchestrator.total(prognoseLines);

        const { salesPerformance, isPlanApproved } =
            this.buildSalesPerformanceSummaries(salesPerformanceByDepartment);

        return {
            direction: 'shop',
            isClosed: false,
            total: { fact: factTotal, prognose: prognoseTotal },
            rules: ruleBreakdown,
            salesPerformance,
            isPlanApproved,
            // Документ начисления рождается только закрытием периода —
            // у открытого периода его нет.
            accrualStatus: null,
        };
    }

    // Одна строка ответа на каждую строку плана отдела за период (по
    // каждой заведённой категории МойСклад, включая "весь отдел", если
    // такая строка есть) — фронт строит одну карточку "План продаж ·
    // Магазин" с построчной разбивкой по категориям вместо единственной
    // сводки (см. directionSalaryReportSchema.salesPerformance в
    // contracts). Это ЧИСТО отображение — на сам расчёт зарплаты
    // (FloatPercent по category правила) не влияет: тот использует
    // независимую salesPerformanceByCategory (см. calculate() правил).
    private buildSalesPerformanceSummaries(
        performances: ShopSalesPerformance[],
    ): {
        salesPerformance: SalesPerformanceSummary[];
        isPlanApproved: boolean;
    } {
        return {
            // toShopSalesPerformanceSummary типизирован под `| null` только
            // из-за общего с одиночным findForScope-результатом сигнатуры —
            // для элемента реального массива (никогда не null) она всегда
            // возвращает объект.
            salesPerformance: performances.map((performance) =>
                toShopSalesPerformanceSummary(performance)!,
            ),
            isPlanApproved:
                isShopSalesPerformancePlanApprovedList(performances),
        };
    }

    // Три источника инвалидации кэша (PRD: синхронизация домена / правка
    // схемы или правила / правка или утверждение плана) свёрнуты в одну
    // строку сравнения — см. domain/services/accounting-cache-freshness.ts.
    // 'shop' захардкожен: этот сервис живёт в domains/shop/modules/accounting
    // и не переиспользуется сервисом (см. backend/CLAUDE.md, "зеркальные,
    // но независимые" модули доменов).
    private async computeFreshnessStamp(
        schemasVersion: string,
        period: string,
    ): Promise<string> {
        const [domainSyncAt, plans] = await Promise.all([
            this.domainSyncStatus.getLastSuccessfulSyncAt('shop'),
            this.salesPlanRepo.findByPeriod(period),
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

// direction-часть ответа — своя ветка на закрытое/открытое направление
// (дискриминант isClosed), а не единый тип с total.prognose: number | null
// везде: так buildOpenDirection()/buildClosedDirection() умеют вернуть
// total.prognose уже суженным до нужного типа без явного приведения
// (зеркало ClosedDirectionReport/OpenDirectionReport сервиса).
type ClosedDirectionReport = Omit<
    EmployeeSalaryReportResponse,
    'period' | 'isClosed' | 'total'
> & {
    isClosed: true;
    total: { fact: number; prognose: null };
};

type OpenDirectionReport = Omit<
    EmployeeSalaryReportResponse,
    'period' | 'isClosed' | 'total'
> & {
    isClosed: false;
    total: { fact: number; prognose: number };
};
