import type {
    EmployeeSalaryReportRule,
    EmployeeSalaryReportSource,
    FloatPercentInfo,
} from 'ireports-contracts';
import {
    CalculationLine,
    CalculationSourceRef,
} from '@/shared/domain/calculation-line';
import {
    PercentBorder,
    ProductSoldSalaryConfig,
    ShopSalaryRule,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { buildRuleBreakdown } from '@/domains/shop/modules/accounting/domain/services/rule-breakdown.builder';
import { FloatPercentSchedule } from '@/domains/shop/modules/accounting/domain/value-objects/float-percent-schedule.value-object';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/sales-performance.value-object';

// Зеркало domains/service/modules/accounting/application/mappers/to-salary-report-rules.ts
// (Фаза 13.5, issue #57) — независимая реализация в домене shop. Общая
// точка для отчёта сотрудника и отчёта отдела, чтобы форма и правила
// сведения пары «факт/прогноз» не расходились по двум местам.
// rules/factLines/prognoseLines собраны одним и тем же оркестратором за
// один проход на каждый режим — сопоставление по индексу безопасно (см.
// rule-breakdown.builder.ts).
export function buildShopSalaryReportRules(
    rules: ShopSalaryRule[],
    factLines: CalculationLine[],
    prognoseLines: CalculationLine[],
    performance: ShopSalesPerformance | null,
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
            sources: buildResponseSources(fact.sources, prognose.sources),
        };
    });
}

// Сводит sources[] пары ФАКТ/ПРОГНОЗ по позиции — зеркало buildResponseSources
// направления service (to-salary-report-rules.ts): fact.sources и
// prognose.sources построены из одной и той же выборки erpData, порядок и
// состав идентичны в обоих режимах, поэтому сопоставление по индексу
// безопасно.
function buildResponseSources(
    factSources: CalculationSourceRef[],
    prognoseSources: CalculationSourceRef[],
): EmployeeSalaryReportSource[] {
    return factSources.map((source, index) => {
        const prognoseSource = prognoseSources[index];
        return {
            type: source.type,
            id: source.id,
            label: source.label,
            link: source.link,
            itemName: source.itemName,
            amount:
                source.amount === undefined
                    ? undefined
                    : {
                          fact: source.amount,
                          prognose: prognoseSource?.amount ?? null,
                      },
        };
    });
}

function buildThresholdInfo(
    percentBorders: [PercentBorder, PercentBorder, PercentBorder],
    performance: ShopSalesPerformance,
    branch: 'fact' | 'prognose',
): FloatPercentInfo {
    const slice =
        branch === 'fact' ? performance.getFact() : performance.getPrognose();
    return FloatPercentSchedule.create(percentBorders).buildThresholdInfo(
        slice.getPercentCompletion(),
        performance.getPlan().turnover,
        slice.getTurnover(),
    );
}

// Award-типы, где line.rate — процент/множитель, а не денежная ставка за
// единицу (PayPerHour.price, ProductSold/UsedProductSold Fixed.price) —
// appliedPercent для остальных не заполняется, чтобы не путать деньги с
// процентом на UI.
const PERCENT_AWARD_TYPES = new Set(['FixedPercent', 'FloatPercent']);

function isPercentAward(rule: ShopSalaryRule): boolean {
    const award = (rule.config as { award?: { type: string } }).award;
    return !!award && PERCENT_AWARD_TYPES.has(award.type);
}

// Пороги FloatPercent есть только у ProductSold, и только когда его award
// выбран как FloatPercent (а не Fixed/FixedPercent) — UsedProductSold
// FloatPercent вообще не поддерживает (закупщик не привязан к выполнению
// плана продаж, см. salary-rule.types.ts), для остальных типов правил
// (PayPerHour) и остальных award того же правила возвращает null, что и
// означает "поля floatPercent в ответе не будет".
function getFloatPercentBorders(
    rule: ShopSalaryRule,
): [PercentBorder, PercentBorder, PercentBorder] | null {
    if (rule.type === 'ProductSold') {
        const award = (rule.config as ProductSoldSalaryConfig).award;
        return award.type === 'FloatPercent' ? award.percentBorders : null;
    }
    return null;
}
