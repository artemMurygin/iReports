import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import { buildBaseCalculationContext } from '@/domains/service/modules/accounting/domain/services/calculation-context.builder';
import { buildRuleBreakdown } from '@/domains/service/modules/accounting/domain/services/rule-breakdown.builder';
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

// Тонкий сквозной путь Фазы 1, дополненный Фазой 6 ленивым кэшем и
// снапшотом закрытого периода (см.
// docs/payroll/plan-payroll-calculation.md, "Фаза 6: Расчётный период,
// ленивый кэш и снапшоты") — по прямому указанию плана логика встроена
// сюда же, а не в параллельный сервис.
//
// Закрытый период (AccountingPeriod.status === 'CLOSED') отдаётся из
// снапшота целиком, без обращения к оркестратору — снапшот прогноз не
// хранит (закрытый месяц не прогнозируется, см. PRD раздел 6), поэтому
// fact/prognose в ответе совпадают (см. buildClosedReport ниже —
// полноценная раздельная пара «факт/прогноз» с nullable-прогнозом для
// закрытого периода — предмет контракта Фазы 9, которая владеет всей формой
// EmployeeSalaryReportResponse; Фаза 6 сознательно не трогает контракт).
//
// Открытый период считает как и раньше (оркестратор по схеме сотрудника),
// но сперва сверяет freshnessStamp с последним сохранённым в кэше — при
// совпадении отдаёт кэш без вызова оркестратора, при расхождении
// пересчитывает и перезаписывает кэш (см. accounting-cache-freshness.ts).
//
// Пока не реализовано (следующие фазы плана):
// - EmployeeIdentity/ERP-данные в контексте (Фаза 2 и далее);
// - SalesPerformance и isPlanApproved в ответе отчёта (Фаза 9/5) —
//   salesPerformance = null, isPlanApproved = true;
// - направление shop (Фазы 10-13) — directions содержит только 'service'.
@Injectable()
export class GetEmployeeSalaryReportService {
    private readonly direction: AccountingDirection = 'service';

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
    ) {}

    async execute(
        employeeId: number,
        period: string,
    ): Promise<EmployeeSalaryReportResponse> {
        const validatedPeriod = Period.create(period);

        const accountingPeriod = await this.periodRepo.findByDirectionAndPeriod(
            this.direction,
            validatedPeriod.getValue(),
        );

        if (accountingPeriod?.isClosed()) {
            return this.buildClosedReport(
                validatedPeriod.getValue(),
                employeeId,
            );
        }

        return this.buildOpenReport(validatedPeriod, employeeId);
    }

    private async buildClosedReport(
        period: string,
        employeeId: number,
    ): Promise<EmployeeSalaryReportResponse> {
        const snapshot = await this.snapshotRepo.findByKey(
            this.direction,
            period,
            employeeId,
        );
        const total = snapshot?.total ?? 0;
        // Закрытый месяц прогноза не хранит (см. шапку файла) — прогноз в
        // ответе намеренно равен факту, а не занижен до нуля: ноль читался
        // бы как "правило перестало действовать", а не "прогноз не
        // считается для закрытого периода".
        const rules = (snapshot?.lines ?? []).map((line) => ({
            ruleId: line.ruleId,
            type: line.type,
            name: line.name,
            targetRole: line.targetRole,
            amount: { fact: line.amount, prognose: line.amount },
            sources: line.sources,
        }));

        return {
            period,
            isClosed: true,
            directions: [
                {
                    direction: this.direction,
                    total: { fact: total, prognose: total },
                    rules,
                    salesPerformance: null,
                    isPlanApproved: true,
                },
            ],
            grandTotal: { fact: total, prognose: total },
        };
    }

    private async buildOpenReport(
        validatedPeriod: Period,
        employeeId: number,
    ): Promise<EmployeeSalaryReportResponse> {
        const period = validatedPeriod.getValue();
        const schema =
            await this.motivationSchemaRepo.findByEmployee(employeeId);
        const rules = schema?.getProps().rules ?? [];

        const freshnessStamp = await this.computeFreshnessStamp(schema, period);

        const cached = await this.cacheRepo.find(
            this.direction,
            period,
            employeeId,
        );
        if (cached && cached.freshnessStamp === freshnessStamp) {
            return this.buildResponse(
                period,
                rules,
                cached.factLines,
                cached.prognoseLines,
            );
        }

        const baseContext: Omit<CalculationContext, 'mode'> =
            buildBaseCalculationContext(
                this.direction,
                validatedPeriod,
                employeeId,
            );

        const [factLines, prognoseLines] = await Promise.all([
            PeriodCalculationOrchestrator.calculate(rules, {
                ...baseContext,
                mode: 'FACT',
            }),
            PeriodCalculationOrchestrator.calculate(rules, {
                ...baseContext,
                mode: 'PROGNOSE',
            }),
        ]);

        const factTotal = PeriodCalculationOrchestrator.total(factLines);
        const prognoseTotal =
            PeriodCalculationOrchestrator.total(prognoseLines);

        await this.cacheRepo.upsert(this.direction, period, employeeId, {
            freshnessStamp,
            factLines,
            prognoseLines,
            factTotal,
            prognoseTotal,
        });

        return this.buildResponse(period, rules, factLines, prognoseLines);
    }

    private buildResponse(
        period: string,
        rules: SalaryRule[],
        factLines: CalculationLine[],
        prognoseLines: CalculationLine[],
    ): EmployeeSalaryReportResponse {
        const factBreakdown = buildRuleBreakdown(rules, factLines);
        const prognoseBreakdown = buildRuleBreakdown(rules, prognoseLines);

        const ruleBreakdown = factBreakdown.map((fact, index) => ({
            ruleId: fact.ruleId,
            type: fact.type,
            name: fact.name,
            targetRole: fact.targetRole,
            amount: {
                fact: fact.amount,
                prognose: prognoseBreakdown[index].amount,
            },
            sources: fact.sources,
        }));

        const factTotal = PeriodCalculationOrchestrator.total(factLines);
        const prognoseTotal =
            PeriodCalculationOrchestrator.total(prognoseLines);

        return {
            period,
            isClosed: false,
            directions: [
                {
                    direction: this.direction,
                    total: { fact: factTotal, prognose: prognoseTotal },
                    rules: ruleBreakdown,
                    salesPerformance: null,
                    isPlanApproved: true,
                },
            ],
            grandTotal: { fact: factTotal, prognose: prognoseTotal },
        };
    }

    // Три источника инвалидации кэша (PRD: синхронизация домена / правка
    // схемы или правила / правка или утверждение плана) свёрнуты в одну
    // строку сравнения — см. domain/services/accounting-cache-freshness.ts.
    private async computeFreshnessStamp(
        schema: MotivationSchema | null,
        period: string,
    ): Promise<string> {
        const [domainSyncAt, plans] = await Promise.all([
            this.domainSyncStatus.getLastSuccessfulSyncAt(this.direction),
            this.salesPlanRepo.findByDirectionAndPeriod(this.direction, period),
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
