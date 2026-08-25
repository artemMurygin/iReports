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

type RuleSource = SalaryReportRule['sources'][number]

const DEFAULT_VISIBLE_COUNT = 3

/** Fallback для источников без описания устройства (см. `composeDeviceName`) — задача/позиция
 * отгрузки МойСклад сегодня не несут ни бренда, ни модели. Тот же словарь, что и у старой
 * `pages/SalaryReport/ui/RuleSources.tsx` (не переиспользован напрямую — `pages` не может
 * импортировать другую `pages`, `boundaries/dependencies`). */
const SOURCE_TYPE_LABELS: Record<string, string> = {
    order: 'Заказ',
    serviceOrderItem: 'Позиция услуги',
    taskCompletion: 'Задача',
    demandPosition: 'Позиция отгрузки',
}

function getSourceTypeLabel(type: string): string {
    return SOURCE_TYPE_LABELS[type] ?? type
}

/** Наименование модели устройства ("Apple iPhone 12 Pro, Space Gray") — brand + deviceModel +
 * deviceColor источника-заказа RemOnline (см. `order-payed.entity.ts`/`service-completed.entity.ts`
 * на бэкенде). `null` — источник не заказ/позиция заказа, либо ERP не отдал ни одного из этих полей
 * по заказу (в т.ч. у снапшотов закрытого периода, сохранённых до появления этих полей). Результат
 * идёт в основной лейбл строки, только если у источника нет `itemName` (см. `RuleSourcesRail`) —
 * иначе используется как первый элемент меты (см. `composeSourceMeta`), а без обоих полей колонка
 * падает на `getSourceTypeLabel`. */
function composeDeviceName(source: RuleSource): string | null {
    const parts = [source.brand, source.deviceModel].filter(Boolean)
    if (parts.length === 0) return null
    const name = parts.join(' ')
    return source.deviceColor ? `${name}, ${source.deviceColor}` : name
}

/** Вторая строка под основным лейблом — номер документа-источника ("№А123456") и неисправность
 * через точку, без пустых частей; `null`, если нет ни того ни другого. Когда `source.itemName`
 * вытеснил наименование устройства в основной лейбл (см. `RuleSourcesRail`), `deviceName` (уже
 * посчитанный вызывающим кодом через `composeDeviceName`) добавляется сюда первым элементом —
 * иначе оно нигде не показывалось бы. */
function composeSourceMeta(source: RuleSource, deviceName: string | null): string | null {
    const docLabel = source.label ? `№${source.label}` : null
    const parts = [deviceName, docLabel, source.malfunction].filter(Boolean)
    return parts.length > 0 ? parts.join(' · ') : null
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
 * `Uaxkm`/`yCFpT` — мобайл): подзаголовок "Позиция / Факт, ₽ / Прогноз, ₽" + по одной строке на
 * видимый источник + завершающая строка "Остаток". Табличный аналог старой
 * `pages/SalaryReport/ui/RuleSources.tsx` (те же данные, `SalaryReportRule['sources']`, тот же
 * порог "показать 3, затем всё" и та же деградация при отсутствии `label`/`link`/`amount`), но
 * заведён заново под новую колончатую раскладку карточки-гроссбуха, а не карточным списком.
 *
 * "Позиция" — одна гибкая колонка (не пара "Документ"+"Позиция", как раньше): основной лейбл сверху
 * — `source.itemName` (конкретный проданный товар/услуга), если он есть, иначе наименование
 * устройства (`composeDeviceName`), иначе тип источника (`getSourceTypeLabel`) — номер документа +
 * неисправность (`composeSourceMeta`) снизу мелким текстом; когда лейбл сверху взят из `itemName`,
 * туда же первым элементом добавляется и наименование устройства, чтобы оно не терялось. Раньше
 * номер документа был отдельной колонкой фиксированной ширины
 * (`w-16`/`md:w-20`) — на мобильном её нешринкающийся минимум вместе с более глубоким `pl-6` этого
 * блока превышал доступную ширину карточки, и колонки Факт/Прогноз съезжали правее одноимённых
 * колонок строки правила над ними (на десктопе `md:` карточка достаточно широкая, чтобы этого не
 * было заметно). Слияние в одну `min-w-0 flex-1` колонку убирает этот нешринкающийся остаток
 * целиком, а не просто уменьшает его.
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
                <span className="min-w-0 flex-1 font-ui text-[11px] font-semibold text-ink-muted">Позиция</span>
                <span className={cn(LEDGER_VALUE_COL, 'font-ui text-[11px] font-semibold text-ink-muted')}>Факт, ₽</span>
                <span className={cn(LEDGER_VALUE_COL, 'font-ui text-[11px] font-semibold text-ink-muted')}>Прогноз, ₽</span>
                <span className={LEDGER_CHEVRON_COL} aria-hidden />
            </div>

            {visible.map((source, index) => {
                const deviceName = composeDeviceName(source)
                const primaryLabel = source.itemName ?? deviceName ?? getSourceTypeLabel(source.type)
                const meta = composeSourceMeta(source, primaryLabel === source.itemName ? deviceName : null)
                return (
                    <div
                        key={`${source.type}-${source.id}-${index}`}
                        className="flex items-center gap-2 border-b border-hairline py-2 last:border-b-0 md:gap-3"
                    >
                        <span className="min-w-0 flex-1">
                            {source.link ? (
                                <a
                                    href={source.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block truncate font-ui text-xs font-semibold text-info-ink hover:underline"
                                >
                                    {primaryLabel}
                                </a>
                            ) : (
                                <span className="block truncate font-ui text-xs font-semibold text-ink">{primaryLabel}</span>
                            )}
                            {meta && <span className="block truncate font-ui text-[11px] text-ink-muted">{meta}</span>}
                        </span>
                        <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-bold text-ink tabular-nums')}>
                            {source.amount ? formatCurrency(source.amount.fact) : '—'}
                        </span>
                        <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-bold text-ink-muted tabular-nums')}>
                            {source.amount?.prognose == null ? '—' : formatCurrency(source.amount.prognose)}
                        </span>
                        <span className={LEDGER_CHEVRON_COL} aria-hidden />
                    </div>
                )
            })}

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
