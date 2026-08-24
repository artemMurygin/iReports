import { isFloatPercentRule, type SalaryReportRule } from './types.ts'

function formatPercentValue(value: number): string {
    return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/**
 * "3,5% → 4,0%" (Pencil `b6mfxv`'s `MspCn`/`d8XFk`'s `jEeLn`) — фактически применённый процент
 * KPI-правила (`rule.appliedPercent`, посчитан бэкендом для FACT-прохода: `basePercent *
 * multiplier`, см. `to-salary-report-rules.ts`/`order-payed.entity.ts`) и его прогнозная
 * проекция.
 *
 * Контракт (`employeeSalaryReportRuleSchema`) не отдаёт отдельного прогнозного процента —
 * `appliedPercent` всегда посчитан только на FACT-ветке. Прогнозный процент восстанавливается
 * здесь из отношения множителей текущего порога FACT/PROGNOSE
 * (`rule.floatPercent.{fact,prognose}.currentThreshold.multiplier`): `basePercent` сокращается
 * (`appliedPercent = basePercent * factMultiplier`, значит `basePercent = appliedPercent /
 * factMultiplier`), что даёт точное значение для порогов в режиме `FIX` и близкое приближение
 * для `LINEAR` (сам расчёт использует интерполированный множитель между порогами, а не множитель
 * порога как есть, — контракт эту интерполяцию наружу не отдаёт). Возвращает только факт (без
 * стрелки), если прогнозный множитель недоступен, и `null` — если правило не KPI/`appliedPercent`
 * отсутствует, а также для закрытого периода (`isClosed`), где прогноз в принципе не считается.
 */
export function formatFloatPercentRange(rule: SalaryReportRule, isClosed: boolean): string | null {
    if (!isFloatPercentRule(rule) || rule.appliedPercent === undefined) return null

    const factPercent = rule.appliedPercent
    const floatPercent = rule.floatPercent
    if (isClosed || !floatPercent) return formatPercentValue(factPercent)

    const factMultiplier = floatPercent.fact.currentThreshold?.multiplier
    const prognoseMultiplier = floatPercent.prognose.currentThreshold?.multiplier

    if (factMultiplier && prognoseMultiplier != null) {
        const prognosePercent = factPercent * (prognoseMultiplier / factMultiplier)
        return `${formatPercentValue(factPercent)} → ${formatPercentValue(prognosePercent)}`
    }

    return formatPercentValue(factPercent)
}
