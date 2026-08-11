import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import { toSalesPerformanceContext } from '@/domains/service/modules/accounting/application/mappers/to-sales-performance-context';
import {
    isSalesPerformancePlanApproved,
    toSalesPerformanceSummary,
} from '@/domains/service/modules/accounting/application/mappers/to-sales-performance-summary';
import { buildSalaryReportRules } from '@/domains/service/modules/accounting/application/mappers/to-salary-report-rules';
import {
    buildFreshnessStamp,
    motivationSchemaVersion,
    stampOf,
} from '@/domains/service/modules/accounting/domain/services/accounting-cache-freshness';
import { Period } from '@/shared/domain/period.value-object';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
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
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { PeriodCalculationOrchestrator as ShopPeriodCalculationOrchestrator } from '@/domains/shop/modules/accounting/domain/services/period-calculation.orchestrator';
import { toShopSalesPerformanceContext } from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-context';
import {
    isShopSalesPerformancePlanApproved,
    toShopSalesPerformanceSummary,
} from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-summary';
import { buildShopSalaryReportRules } from '@/domains/shop/modules/accounting/application/mappers/to-shop-salary-report-rules';

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
// buildClosedServiceDirection/buildClosedShopDirection ниже).
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
// Контекст расчёта (EmployeeIdentity + erpData) собирают
// BuildServiceCalculationContextService/BuildShopCalculationContextService
// (Фаза 7/9, Фаза 13.5) — этот сервис больше не строит его напрямую. Режим
// FACT/PROGNOSE (Фаза 9) — единственное отличие между двумя проходами
// calculate(): в каждый передаётся один и тот же erpData/identities, но
// разный percentCompletion (см. to-sales-performance-context.ts).
//
// Фаза 13.5 (см. docs/payroll/phase-13.5-shop-report-integration.md):
// направление shop подключено параллельно service — каждое направление
// закрывается и считается независимо (свой AccountingPeriod, свой
// motivationSchemaRepo, свой контекст-билдер, свой оркестратор — "зеркальные,
// но независимые" деревья service/shop, см. backend/CLAUDE.md), grandTotal
// сводит оба направления по формулам из "Решений по открытым вопросам"
// плана: fact — простая сумма, prognose — сумма (prognose ?? fact), где
// null возможен только у закрытого направления.
@Injectable()
export class GetEmployeeSalaryReportService {
    constructor(
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
        private readonly contextBuilder: BuildServiceCalculationContextService,
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        private readonly shopContextBuilder: BuildShopCalculationContextService,
    ) {}

    async execute(
        employeeId: number,
        period: string,
    ): Promise<EmployeeSalaryReportResponse> {
        const validatedPeriod = Period.create(period);
        const periodValue = validatedPeriod.getValue();

        const [serviceAccountingPeriod, shopAccountingPeriod] =
            await Promise.all([
                this.periodRepo.findByDirectionAndPeriod(
                    'service',
                    periodValue,
                ),
                this.periodRepo.findByDirectionAndPeriod('shop', periodValue),
            ]);

        const [serviceDirection, shopDirection] = await Promise.all([
            serviceAccountingPeriod?.isClosed()
                ? this.buildClosedServiceDirection(periodValue, employeeId)
                : this.buildOpenServiceDirection(validatedPeriod, employeeId),
            shopAccountingPeriod?.isClosed()
                ? this.buildClosedShopDirection(periodValue, employeeId)
                : this.buildOpenShopDirection(validatedPeriod, employeeId),
        ]);

        return this.combineDirections(
            periodValue,
            serviceDirection,
            shopDirection,
        );
    }

    // grandTotal.fact — простая сумма fact по направлениям (оба всегда
    // числа). grandTotal.prognose — (isClosed ? fact : prognose) по каждому
    // направлению: закрытое направление не хранит прогноз, но экономически
    // сумма уже финальна и равна факту (Решение №2, см. шапку файла) —
    // изложено через isClosed, а не через ?? total.fact, чтобы намерение
    // было явным, а не полагалось на то, что total.prognose у открытого
    // направления никогда не бывает null.
    private combineDirections(
        period: string,
        serviceDirection: DirectionReport,
        shopDirection: DirectionReport,
    ): EmployeeSalaryReportResponse {
        const fact = serviceDirection.total.fact + shopDirection.total.fact;
        const prognose =
            (serviceDirection.isClosed
                ? serviceDirection.total.fact
                : serviceDirection.total.prognose) +
            (shopDirection.isClosed
                ? shopDirection.total.fact
                : shopDirection.total.prognose);

        return {
            period,
            directions: [serviceDirection, shopDirection],
            grandTotal: { fact, prognose },
        };
    }

    private async buildClosedServiceDirection(
        period: string,
        employeeId: number,
    ): Promise<ClosedDirectionReport> {
        const snapshot = await this.snapshotRepo.findByKey(
            'service',
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
        };
    }

    private async buildOpenServiceDirection(
        validatedPeriod: Period,
        employeeId: number,
    ): Promise<OpenDirectionReport> {
        const period = validatedPeriod.getValue();
        const schema =
            await this.motivationSchemaRepo.findByEmployee(employeeId);
        const rules = schema?.getProps().rules ?? [];

        const freshnessStamp = await this.computeFreshnessStamp(
            'service',
            schema,
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
        };
    }

    // Зеркало buildClosedServiceDirection — читает снапшот направления shop
    // (AccountingPeriodSnapshotPort уже generic по direction, свой снапшот
    // на каждое направление, см. Решение №1 плана).
    private async buildClosedShopDirection(
        period: string,
        employeeId: number,
    ): Promise<ClosedDirectionReport> {
        const snapshot = await this.snapshotRepo.findByKey(
            'shop',
            period,
            employeeId,
        );
        const total = snapshot?.total ?? 0;
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

    // Зеркало buildOpenServiceDirection — та же схема (кэш →
    // freshnessStamp → оркестратор), но собственные shop-порты/контекст-
    // билдер/оркестратор (см. backend/CLAUDE.md, "зеркальные, но независимые"
    // модули доменов). shopContextBuilder.build() принимает третий параметр
    // rules — в отличие от сервисной сигнатуры, categoryDescendantFolderIds
    // раскрывается только для категорий, реально встречающихся в правилах
    // схемы (см. build-shop-calculation-context.service.ts).
    private async buildOpenShopDirection(
        validatedPeriod: Period,
        employeeId: number,
    ): Promise<OpenDirectionReport> {
        const period = validatedPeriod.getValue();
        const schema =
            await this.shopMotivationSchemaRepo.findByEmployee(employeeId);
        const rules = schema?.getProps().rules ?? [];

        const freshnessStamp = await this.computeFreshnessStamp(
            'shop',
            schema,
            period,
        );

        const cached = await this.cacheRepo.find('shop', period, employeeId);
        if (cached && cached.freshnessStamp === freshnessStamp) {
            const salesPerformanceDetail =
                await this.shopContextBuilder.findSalesPerformanceForEmployee(
                    validatedPeriod,
                    employeeId,
                );
            return this.buildShopDirectionResponse(
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
                    baseContext.salesPerformanceDetail,
                    'FACT',
                ),
            }),
            ShopPeriodCalculationOrchestrator.calculate(rules, {
                employee: baseContext.employee,
                period: baseContext.period,
                erpData: baseContext.erpData,
                mode: 'PROGNOSE',
                salesPerformance: toShopSalesPerformanceContext(
                    baseContext.salesPerformanceDetail,
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

        return this.buildShopDirectionResponse(
            rules,
            factLines,
            prognoseLines,
            baseContext.salesPerformanceDetail,
        );
    }

    private buildShopDirectionResponse(
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
    // Один метод на оба направления: domainSyncStatus/salesPlanRepo уже
    // generic по direction, а motivationSchemaVersion() принимает
    // структурный тип (MotivationSchemaLike), которому удовлетворяют и
    // MotivationSchema, и ShopMotivationSchema (Фаза 13.5).
    private async computeFreshnessStamp(
        direction: AccountingDirection,
        schema: MotivationSchema | ShopMotivationSchema | null,
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
            motivationSchemaVersion: motivationSchemaVersion(schema),
            domainSyncStamp: stampOf(domainSyncAt),
            salesPlanStamp: stampOf(salesPlanAt),
        });
    }
}

// Один элемент directions[] ответа — своя ветка на закрытое/открытое
// направление (дискриминант isClosed), а не единый тип с total.prognose:
// number | null везде: так combineDirections() умеет сузить
// total.prognose до number в открытой ветке без явного приведения типов
// (см. комментарий у combineDirections).
type EmployeeSalaryReportDirection =
    EmployeeSalaryReportResponse['directions'][number];

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

type DirectionReport = ClosedDirectionReport | OpenDirectionReport;
