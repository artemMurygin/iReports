import { formatCurrency } from '@/features/SalesPlan'
import { formatFloatPercentRange, isFloatPercentRule, type SalaryReportRule } from '@/features/SalaryReportData'

/**
 * Пара «факт / прогноз» подписи ставки под суммой строки правила (Pencil:
 * `design/sallary-first-iteration.pen`, узел `H7Mz74` "Ledger · Зарплата" -> `cyS5Q`'s `mbz5u`/
 * `S9NJc` — "Ставка" под каждым значением: `null`, если для правила её вообще не показывают
 * (фикс-ставка без источников, KPI без применённого процента) — та колонка тогда просто пустая.
 */
export type RuleRate = { fact: string; prognose: string | null }

/**
 * KPI-правило (`isFloatPercentRule`) — переиспользует готовую математику восстановления
 * прогнозного процента из `features/SalaryReportData`'s `formatFloatPercentRange` (см. её
 * комментарий: из отношения множителей текущего порога FACT/PROGNOSE), а не пересчитывает её
 * заново — только разбирает её единую строку "X% → Y%" на пару отдельных подписей: новый макет
 * кладёт "Ставка" под каждым значением своей колонки (`mbz5u [Факт] -> naUlS [Ставка]` = "3,5% от
 * маржи", `S9NJc [Прогноз] -> y29UR [Ставка]` = "4,0% от маржи"), а не общей парой у одной ячейки,
 * как в старом `RulesTable`.
 *
 * Базу начисления ("от маржи"/"от выручки"/...) контракт не отдаёт отдельным полем
 * (`salaryBasis` есть только в `config` создания правила, не в отчёте) — мокап десктопа рисует
 * "от маржи" на конкретном сэмпле (правило действительно называется "Процент с маржи заказа"), но
 * подставлять это слово для ЛЮБОГО KPI-правила было бы фабрикацией данных для правил с другой
 * базой. Мобильный
 * мокап (`b63e8p`'s `ujO0v`/`aTGk0`) той же строки показывает голое "3,5%"/"4,0%" без базы — этому
 * варианту здесь и следуем на обеих ширинах.
 *
 * Правило с фиксированной ставкой — контракт тоже не отдаёт цену за единицу/количество единиц
 * отдельно (то, что мокап рисует как "1 200 ₽ × 24"), но `rule.sources[]` — реальный список
 * начислявших документов той же строки, и цена за единицу правила фиксированной ставки одна и та
 * же для всех её источников (см. `award: { type: 'Fixed', price }` в контракте создания правила).
 * Поэтому единичная цена восстанавливается как `amount.fact / sources.length` — не выдумка, а
 * реальное деление уже загруженных полей; количество прогнозных единиц — `amount.prognose /
 * unitPrice` при той же (неизменной за период) цене.
 */
export function getRuleRate(rule: SalaryReportRule, isClosed: boolean): RuleRate | null {
    if (isFloatPercentRule(rule)) {
        const range = formatFloatPercentRange(rule, isClosed)
        if (!range) return null

        const [factLabel, prognoseLabel] = range.split(' → ')
        return { fact: factLabel, prognose: prognoseLabel ?? null }
    }

    const unitCount = rule.sources.length
    if (unitCount === 0) return null

    const unitPrice = rule.amount.fact / unitCount
    const factLabel = `${formatCurrency(Math.round(unitPrice))} × ${unitCount}`
    if (rule.amount.prognose === null || unitPrice <= 0) return { fact: factLabel, prognose: null }

    const prognoseCount = Math.round(rule.amount.prognose / unitPrice)
    return { fact: factLabel, prognose: `${formatCurrency(Math.round(unitPrice))} × ${prognoseCount}` }
}
