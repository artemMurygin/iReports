import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import type { SalaryReportRule } from '@/features/SalaryReportData'

import { LEDGER_CHEVRON_COL, LEDGER_VALUE_COL } from '../model/ledgerColumns.ts'

export type RuleSourcesRailProps = {
    sources: SalaryReportRule['sources']
    className?: string
}

const DEFAULT_VISIBLE_COUNT = 3

/** Тот же словарь и fallback, что и у старой `pages/SalaryReport/ui/RuleSources.tsx` (не
 * переиспользован напрямую — `pages` не может импортировать другую `pages`, `boundaries/dependencies`).
 * Используется как текст колонки "Позиция" — контракт не отдаёт отдельного описания
 * устройства/товара (см. `getRuleRate`'s комментарий про ту же нехватку поля), только тип
 * источника. */
const SOURCE_TYPE_LABELS: Record<string, string> = {
    order: 'Заказ',
    serviceOrderItem: 'Позиция услуги',
    taskCompletion: 'Задача',
    demandPosition: 'Позиция отгрузки',
}

function getSourceTypeLabel(type: string): string {
    return SOURCE_TYPE_LABELS[type] ?? type
}

function sumAmounts(sources: SalaryReportRule['sources'], pick: 'fact' | 'prognose'): number | null {
    let sum = 0
    for (const source of sources) {
        const value = source.amount?.[pick]
        if (value == null) return null
        sum += value
    }
    return sum
}

/**
 * Разворот правила в документы (Pencil: `H7Mz74`'s `oea4S`/`uU8GI` "Rail" — десктоп, `b63e8p`'s
 * `Uaxkm`/`yCFpT` — мобайл): подзаголовок "Документ / Позиция / Факт, ₽ / Прогноз, ₽" + по одной
 * строке на видимый источник + завершающая строка "Остаток". Табличный аналог старой
 * `pages/SalaryReport/ui/RuleSources.tsx` (те же данные, `SalaryReportRule['sources']`, тот же
 * порог "показать 3, затем всё" и та же деградация при отсутствии `label`/`link`/`amount`), но
 * заведён заново под новую колончатую раскладку карточки-гроссбуха, а не карточным списком.
 *
 * "Остаток" суммирует ФАКТ и ПРОГНОЗ по скрытым источникам отдельно под их настоящими колонками —
 * в отличие от макета, где под строкой "ещё N заказов" показано только одно число (и оно сидит под
 * позицией колонки "Факт", хотя подписано "Прогноз" — похоже на артефакт мокапа, не осознанное
 * решение). Здесь оба агрегата настоящие (сумма `source.amount` скрытых элементов), а не
 * подгонка под пиксели одного примера.
 *
 * Каждая строка заканчивается тем же невидимым `LEDGER_CHEVRON_COL`-спейсером и тем же `gap-2
 * md:gap-3`, что и кнопка `LedgerRuleRow` выше неё: та резервирует эту колонку под шеврон
 * разворота, здесь его нет — без спейсера колонки Факт/Прогноз этого "Rail" съезжали бы правее
 * колонок строки правила и заголовка над ней ровно на ширину шеврона.
 */
export function RuleSourcesRail({ sources, className }: RuleSourcesRailProps) {
    const [showAll, setShowAll] = useState(false)

    if (sources.length === 0) {
        return (
            <div className={cn('py-2.5 pr-3 pl-6 font-ui text-xs text-ink-muted md:pr-5 md:pl-10', className)}>
                Нет связанных документов
            </div>
        )
    }

    const visible = showAll ? sources : sources.slice(0, DEFAULT_VISIBLE_COUNT)
    const hidden = sources.slice(visible.length)

    return (
        <div data-slot="rule-sources-rail" className={cn('flex flex-col py-2.5 pr-3 pl-6 md:pr-5 md:pl-10', className)}>
            <div className="flex items-center gap-2 border-b border-hairline pb-1.5 md:gap-3">
                <span className="w-16 shrink-0 font-ui text-[11px] font-semibold text-ink-muted md:w-20">Документ</span>
                <span className="min-w-0 flex-1 font-ui text-[11px] font-semibold text-ink-muted">Позиция</span>
                <span className={cn(LEDGER_VALUE_COL, 'font-ui text-[11px] font-semibold text-ink-muted')}>Факт, ₽</span>
                <span className={cn(LEDGER_VALUE_COL, 'font-ui text-[11px] font-semibold text-ink-muted')}>Прогноз, ₽</span>
                <span className={LEDGER_CHEVRON_COL} aria-hidden />
            </div>

            {visible.map((source, index) => (
                <div
                    key={`${source.type}-${source.id}-${index}`}
                    className="flex items-center gap-2 border-b border-hairline py-2 last:border-b-0 md:gap-3"
                >
                    <span className="w-16 shrink-0 truncate font-ui text-xs font-semibold text-info-ink md:w-20">
                        {source.link ? (
                            <a href={source.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {source.label ?? `#${source.id}`}
                            </a>
                        ) : (
                            (source.label ?? `#${source.id}`)
                        )}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-ui text-xs text-ink">{getSourceTypeLabel(source.type)}</span>
                    <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-bold text-ink tabular-nums')}>
                        {source.amount ? formatCurrency(source.amount.fact) : '—'}
                    </span>
                    <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-bold text-ink-muted tabular-nums')}>
                        {source.amount?.prognose == null ? '—' : formatCurrency(source.amount.prognose)}
                    </span>
                    <span className={LEDGER_CHEVRON_COL} aria-hidden />
                </div>
            ))}

            {hidden.length > 0 && (
                <div className="flex items-center gap-2 pt-2 md:gap-3">
                    <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="flex min-w-0 flex-1 items-center gap-1 font-ui text-xs font-semibold text-info-ink hover:underline"
                    >
                        ещё {hidden.length} {hidden.length === 1 ? 'документ' : 'документов'}
                        <ChevronRight className="size-3.5 shrink-0" />
                    </button>
                    <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-bold text-ink tabular-nums')}>
                        {(() => {
                            const sum = sumAmounts(hidden, 'fact')
                            return sum === null ? '—' : formatCurrency(sum)
                        })()}
                    </span>
                    <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-bold text-ink-muted tabular-nums')}>
                        {(() => {
                            const sum = sumAmounts(hidden, 'prognose')
                            return sum === null ? '—' : formatCurrency(sum)
                        })()}
                    </span>
                    <span className={LEDGER_CHEVRON_COL} aria-hidden />
                </div>
            )}
        </div>
    )
}
