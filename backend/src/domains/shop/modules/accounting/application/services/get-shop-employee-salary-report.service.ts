import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { CalculationLine } from '@/shared/domain/calculation-line';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { PeriodCalculationOrchestrator as ShopPeriodCalculationOrchestrator } from '@/domains/shop/modules/accounting/domain/services/period-calculation.orchestrator';
import { toShopSalesPerformanceContext } from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-context';
import {
    isShopSalesPerformancePlanApproved,
    toShopSalesPerformanceSummary,
} from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-summary';
import { buildShopSalaryReportRules } from '@/domains/shop/modules/accounting/application/mappers/to-shop-salary-report-rules';
import {
    buildFreshnessStamp,
    stampOf,
} from '@/domains/service/modules/accounting/domain/services/accounting-cache-freshness';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/resolve-shop-employee-salary-rules.service';
import { Period } from '@/shared/domain/period.value-object';
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
// ACCOUNTING_PERIOD_REPOSITORY/ACCOUNTING_PERIOD_SNAPSHOT/
// ACCOUNTING_CALCULATION_CACHE физически объявлены в
// domains/service/modules/accounting, но сами реализации (Prisma-
// репозитории) не содержат service-специфичной логики — ключ
// direction+period, тот же приём, что уже применён в
// ShopAccountingModule для GetAccountingPeriodService (см.
// shop-accounting.module.ts).
@Injectable()
export class GetShopEmployeeSalaryReportService {
    constructor(
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
        private readonly shopContextBuilder: BuildShopCalculationContextService,
        private readonly salaryRulesResolver: ResolveShopEmployeeSalaryRulesService,
    ) {}

    async execute(
        employeeId: number,
        period: string,
    ): Promise<EmployeeSalaryReportResponse> {
        const validatedPeriod = Period.create(period);
        const periodValue = validatedPeriod.getValue();

        const accountingPeriod = await this.periodRepo.findByDirectionAndPeriod(
            'shop',
            periodValue,
        );

        const direction = accountingPeriod?.isClosed()
            ? await this.buildClosedDirection(periodValue, employeeId)
            : await this.buildOpenDirection(validatedPeriod, employeeId);

        return { period: periodValue, ...direction };
    }

    private async buildClosedDirection(
        period: string,
        employeeId: number,
    ): Promise<ClosedDirectionReport> {
        const snapshot = await this.snapshotRepo.findByKey(
            'shop',
            period,
            employeeId,
        );
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
            sources: line.sources,
        }));

        return {
            direction: 'shop',
            isClosed: true,
            total: { fact: total, prognose: null },
            rules,
            salesPerformance: null,
            isPlanApproved: true,
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

        const cached = await this.cacheRepo.find('shop', period, employeeId);
        if (cached && cached.freshnessStamp === freshnessStamp) {
            const salesPerformanceDetail =
                await this.shopContextBuilder.findSalesPerformanceForEmployee(
                    validatedPeriod,
                    employeeId,
                );
            return this.buildDirectionResponse(
                rules,
                cached.factLines,
                cached.prognoseLines,
                salesPerformanceDetail,
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

        await this.cacheRepo.upsert('shop', period, employeeId, {
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
        );
    }

    private buildDirectionResponse(
        rules: ShopSalaryRule[],
        factLines: CalculationLine[],
        prognoseLines: CalculationLine[],
        salesPerformanceDetail: Parameters<
            typeof buildShopSalaryReportRules
        >[3],
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

        return {
            direction: 'shop',
            isClosed: false,
            total: { fact: factTotal, prognose: prognoseTotal },
            rules: ruleBreakdown,
            salesPerformance: toShopSalesPerformanceSummary(
                salesPerformanceDetail,
            ),
            isPlanApproved: isShopSalesPerformancePlanApproved(
                salesPerformanceDetail,
            ),
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
            this.salesPlanRepo.findByDirectionAndPeriod('shop', period),
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
