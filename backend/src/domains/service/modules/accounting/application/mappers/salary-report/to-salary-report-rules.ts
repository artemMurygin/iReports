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
    OrderPayedSalaryConfig,
    PercentBorder,
    SalaryRule,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import {
    buildRuleBreakdown,
    RuleBreakdownLine,
} from '@/domains/service/modules/accounting/domain/services/rule-breakdown.builder';
import { buildFloatPercentThresholdInfo } from '@/domains/service/modules/accounting/domain/services/float-percent';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';

// Разбирает разбивку по правилу для ответа зарплатного отчёта (Фаза 9, см.
// docs/payroll/prd-payroll-calculation.md, раздел 6) — общая точка для
// отчёта сотрудника (GetEmployeeSalaryReportService) и отчёта отдела
// (GetDepartmentSalaryReportService), чтобы форма и правила сведения пары
// «факт/прогноз» не расходились по двум местам.
//
// factLines/prognoseLines собраны одним и тем же оркестратором за один
// проход на каждый режим, но, в отличие от rule-breakdown.builder.ts,
// сопоставление здесь не может быть позиционным: buildRuleBreakdown уже
// пропускает правила с null-строкой (см. его комментарий), поэтому
// factBreakdown/prognoseBreakdown могут быть короче rules[] и не совпадать
// друг с другом по длине/порядку — сведение идёт по ruleId через Map.
// Правило, отсутствующее хотя бы в одной из двух карт (задача ещё не
// выполнена ни в фактическом, ни в прогнозном проходе, либо выполнена
// только в одном из них), в ответ не попадает — spec:
// service/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения.
export function buildSalaryReportRules(
    rules: SalaryRule[],
    factLines: (CalculationLine | null)[],
    prognoseLines: (CalculationLine | null)[],
    performance: SalesPerformance | null,
): EmployeeSalaryReportRule[] {
    const factByRuleId = toRuleIdMap(buildRuleBreakdown(rules, factLines));
    const prognoseByRuleId = toRuleIdMap(
        buildRuleBreakdown(rules, prognoseLines),
    );

    return rules.flatMap((rule) => {
        const fact = factByRuleId.get(rule.id);
        const prognose = prognoseByRuleId.get(rule.id);
        if (!fact || !prognose) {
            return [];
        }
        const percentBorders = getFloatPercentBorders(rule);

        return [
            {
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
            },
        ];
    });
}

function toRuleIdMap(
    breakdown: RuleBreakdownLine[],
): Map<string, RuleBreakdownLine> {
    return new Map(breakdown.map((line) => [line.ruleId, line]));
}

// Сводит sources[] пары ФАКТ/ПРОГНОЗ по позиции — fact.sources и
// prognose.sources построены из ОДНОГО и того же выборки erpData (одна и
// та же матчащаяся выборка правила, различается только применённая ставка
// FloatPercent/salesPerformance режима — см. entities/salary-rules/*.ts),
// поэтому список источников и их порядок в обоих режимах идентичны, и
// сопоставление по индексу безопасно (тот же приём, что buildRuleBreakdown
// использует для строк правил).
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
            amount:
                source.amount === undefined
                    ? undefined
                    : {
                          fact: source.amount,
                          prognose: prognoseSource?.amount ?? null,
                      },
            brand: source.brand,
            deviceModel: source.deviceModel,
            deviceColor: source.deviceColor,
            malfunction: source.malfunction,
            itemName: source.itemName,
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
// единицу (PayPerHour.price, OrderPayed Fixed.price,
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

// Пороги FloatPercent есть только у OrderPayed, и только когда его award
// выбран как FloatPercent (а не Fixed/FixedPercent) — для остальных типов
// правил (PayPerHour, ServiceCompleted) возвращает null, что и означает
// "поля floatPercent в ответе не будет".
function getFloatPercentBorders(
    rule: SalaryRule,
): [PercentBorder, PercentBorder, PercentBorder] | null {
    if (rule.type === 'OrderPayed') {
        const award = (rule.config as OrderPayedSalaryConfig).award;
        return award.type === 'FloatPercent' ? award.percentBorders : null;
    }
    return null;
}
