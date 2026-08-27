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
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { buildBitrixTaskLink } from '@/integrations/bitrix/bitrix.config';

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
            sources: buildResponseSources(fact.sources, prognose.sources),
            ...buildTaskRuleFields(rule, fact),
        };
    });
}

// bitrixTaskUrl/taskStatus/isTaskUnavailable/actualAmount — только для
// TaskCompleted (change salary-rule-bitrix-task, design.md, contracts/
// commands/salary-rule.ts → employeeSalaryReportRuleSchema); undefined для
// остальных типов правил, поле в ответе просто отсутствует.
//
// bitrixTaskUrl строится от ТЕКУЩЕЙ (последней добавленной) задачи правила
// (rule.bitrixTaskIds), а не от задачи, сматчившейся на конкретный период
// (fact.sources) — ссылка на задачу в схеме/отчёте нужна независимо от
// того, относится ли эта задача к отображаемому периоду (spec.md, "Ссылка
// на задачу Bitrix24"). taskStatus/actualAmount, наоборот, ПЕРИОД-специфичны
// (см. CalculationLine.taskStatus) — только когда задача сматчилась именно
// на период этого отчёта, иначе поле ручного ввода суммы должно остаться
// недоступным (spec.md, "Ручной ввод фактической суммы"). actualAmount —
// значение fact.amount при статусе COMPLETED уже ЕСТЬ эффективная
// фактическая сумма (введённая руководителем или, по умолчанию, полная
// сумма правила — см. task-completed.entity.ts calculate()), отдельно поле
// props.actualAmounts читать не нужно.
function buildTaskRuleFields(
    rule: SalaryRule,
    fact: RuleBreakdownLine,
): Pick<
    EmployeeSalaryReportRule,
    'bitrixTaskUrl' | 'taskStatus' | 'isTaskUnavailable' | 'actualAmount'
> {
    if (!(rule instanceof TaskCompletedEntity)) {
        return {};
    }

    const currentTaskId = rule.bitrixTaskIds[rule.bitrixTaskIds.length - 1];

    return {
        bitrixTaskUrl:
            currentTaskId !== undefined
                ? buildBitrixTaskLink(currentTaskId)
                : undefined,
        taskStatus: fact.taskStatus ?? undefined,
        isTaskUnavailable: fact.isUnavailable,
        actualAmount: fact.taskStatus === 'COMPLETED' ? fact.amount : undefined,
    };
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

// Пороги FloatPercent есть только у OrderPayed, и только когда его award
// выбран как FloatPercent (а не Fixed/FixedPercent) — для остальных типов
// правил (PayPerHour, ServiceCompleted) возвращает null, что и означает
// "поля floatPercent в ответе не будет". TaskCompleted больше не имеет
// award/FloatPercent вовсе (change salary-rule-bitrix-task, design.md
// Decision 2 — единственный вид вознаграждения теперь фиксированная сумма
// rewardAmount), поэтому для него всегда null.
function getFloatPercentBorders(
    rule: SalaryRule,
): [PercentBorder, PercentBorder, PercentBorder] | null {
    if (rule.type === 'OrderPayed') {
        const award = (rule.config as OrderPayedSalaryConfig).award;
        return award.type === 'FloatPercent' ? award.percentBorders : null;
    }
    return null;
}
