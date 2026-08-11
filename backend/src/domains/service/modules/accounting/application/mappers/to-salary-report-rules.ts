import type {
    EmployeeSalaryReportRule,
    FloatPercentInfo,
} from 'ireports-contracts';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    OrderPayedSalaryConfig,
    PercentBorder,
    SalaryRule,
    TaskCompletedSalaryConfig,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { buildRuleBreakdown } from '@/domains/service/modules/accounting/domain/services/rule-breakdown.builder';
import { buildFloatPercentThresholdInfo } from '@/domains/service/modules/accounting/domain/services/float-percent';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';

// Разбирает разбивку по правилу для ответа зарплатного отчёта (Фаза 9, см.
// docs/payroll/prd-payroll-calculation.md, раздел 6) — общая точка для
// отчёта сотрудника (GetEmployeeSalaryReportService) и отчёта отдела
// (GetDepartmentSalaryReportService), чтобы форма и правила сведения пары
// «факт/прогноз» не расходились по двум местам. rules/factLines/
// prognoseLines собраны одним и тем же оркестратором за один проход на
// каждый режим — сопоставление по индексу безопасно (см.
// rule-breakdown.builder.ts).
export function buildSalaryReportRules(
    rules: SalaryRule[],
    factLines: CalculationLine[],
    prognoseLines: CalculationLine[],
    performance: SalesPerformance | null,
): EmployeeSalaryReportRule[] {
    const factBreakdown = buildRuleBreakdown(rules, factLines);
    const prognoseBreakdown = buildRuleBreakdown(rules, prognoseLines);

    return rules.map((rule, index) => {
        const fact = factBreakdown[index];
        const prognose = prognoseBreakdown[index];
        const percentBorders = getFloatPercentBorders(rule);

        return {
            ruleId: fact.ruleId,
            type: fact.type,
            name: fact.name,
            targetRole: fact.targetRole,
            amount: { fact: fact.amount, prognose: prognose.amount },
            appliedPercent: isPercentAward(rule) ? fact.rate : undefined,
            floatPercent:
                percentBorders && performance
                    ? {
                          fact: buildThresholdInfo(
                              percentBorders,
                              performance,
                              'fact',
                          ),
                          prognose: buildThresholdInfo(
                              percentBorders,
                              performance,
                              'prognose',
                          ),
                      }
                    : undefined,
            sources: fact.sources,
        };
    });
}

function buildThresholdInfo(
    percentBorders: [PercentBorder, PercentBorder, PercentBorder],
    performance: SalesPerformance,
    branch: 'fact' | 'prognose',
): FloatPercentInfo {
    const slice =
        branch === 'fact' ? performance.getFact() : performance.getPrognose();
    return buildFloatPercentThresholdInfo(
        percentBorders,
        slice.getPercentCompletion(),
        performance.getPlan().turnover,
        slice.getTurnover(),
    );
}

// Award-типы, где line.rate — процент/множитель, а не денежная ставка за
// единицу (PayPerHour.price, OrderPayed/TaskCompleted Fixed.price,
// ServiceCompleted ServiceFixed) — appliedPercent для остальных не
// заполняется, чтобы не путать деньги с процентом на UI.
const PERCENT_AWARD_TYPES = new Set([
    'FixedPercent',
    'ServicePercent',
    'FloatPercent',
]);

function isPercentAward(rule: SalaryRule): boolean {
    const award = (rule.config as { award?: { type: string } }).award;
    return !!award && PERCENT_AWARD_TYPES.has(award.type);
}

// Пороги FloatPercent есть только у OrderPayed/TaskCompleted, и только
// когда их award выбран как FloatPercent (а не Fixed/FixedPercent) — для
// остальных типов правил (PayPerHour, ServiceCompleted) и остальных award
// того же правила возвращает null, что и означает "поля floatPercent в
// ответе не будет".
function getFloatPercentBorders(
    rule: SalaryRule,
): [PercentBorder, PercentBorder, PercentBorder] | null {
    if (rule.type === 'OrderPayed') {
        const award = (rule.config as OrderPayedSalaryConfig).award;
        return award.type === 'FloatPercent' ? award.percentBorders : null;
    }
    if (rule.type === 'TaskCompleted') {
        const award = (rule.config as TaskCompletedSalaryConfig).award;
        return award.type === 'FloatPercent' ? award.percentBorders : null;
    }
    return null;
}
