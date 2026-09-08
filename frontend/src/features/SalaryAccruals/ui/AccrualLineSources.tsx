import { useState } from 'react'
import { ChevronRight, CornerDownRight } from 'lucide-react'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'

import { deriveHiddenSourcesTotal, pluralizeSources } from '../model/accrualView.ts'
import { getSourceTypeLabel } from '../model/labels.ts'

const DEFAULT_VISIBLE_COUNT = 3
/** «Заказ» / «Позиция услуги» / … колонка — 3 фикс-колонки Rail (`SUM_COL`), см. её комментарий. */
const SUM_COL = 'w-24 shrink-0 text-right md:w-[140px]'

/**
 * Разворот строки документа в источники (Pencil `DQ3tV`'s `d24KNC` "Rail" — десктоп 3 колонки
 * «Заказ / Основание / Начислено, ₽», `g0onp`'s `j0qZy` — мобильный `compact` вариант, одна строка
 * на источник без отдельных колонок). На источник заказа (`type: 'order'`/`'serviceOrderItem'`)
 * бэкенд отдаёт человекочитаемый номер заказа RemOnline (`source.label`), ссылку на его карточку
 * (`source.link`) и сумму начисления по этому источнику (`source.amount`) — см.
 * `calculationSourceRefSchema` в `contracts/commands/salary-rule.ts`. Документ начисления фиксирует
 * только факт (без прогноза), поэтому сумма источника здесь — одно число, в отличие от пары
 * факт/прогноз у `pages/SalaryReportV2/ui/RuleSourcesRail.tsx`.
 *
 * Мокап (`DQ3tV`'s `d24KNC`) рисует дополнительную колонку «Дата» и «Основание» как готовую фразу
 * с базовой суммой до вычета процента («Работы 18 400 ₽»/«Работы 18 400 ₽ · 12.07.2026» на
 * мобильном) — ни даты, ни базовой суммы контракт не отдаёт (`calculationSourceRefSchema` не несёт
 * ни одного из этих полей, только `label`/`link`/`amount`/`itemName`/тип), это была бы фабрикация
 * данных под один пример из мокапа. «Основание» здесь — `source.itemName` (конкретная услуга/товар,
 * когда источник умеет его определить), иначе тип источника (`getSourceTypeLabel`); колонки «Дата»
 * нет вовсе.
 */
export type AccrualLineSourcesProps = {
    sources: SalaryAccrualLine['sources']
    /** Мобильная карточка (`g0onp`): без заголовка колонок, «Основание» второй строкой под
     * номером/суммой источника вместо отдельной колонки. */
    compact?: boolean
    className?: string
}

function AccrualLineSources({ sources, compact = false, className }: AccrualLineSourcesProps) {
    const [showAll, setShowAll] = useState(false)

    if (sources.length === 0) {
        return (
            <div className={cn('flex items-center gap-2 px-3 py-2.5 font-ui text-xs text-ink-muted', className)}>
                <CornerDownRight className="size-3.5 shrink-0 text-ink-faint" />
                Нет связанных источников
            </div>
        )
    }

    const visible = showAll ? sources : sources.slice(0, DEFAULT_VISIBLE_COUNT)
    const hiddenCount = sources.length - visible.length
    const hiddenTotal = deriveHiddenSourcesTotal(sources, visible.length)

    return (
        <div data-slot="accrual-line-sources" className={cn('flex flex-col px-3 py-2.5 md:px-5', className)}>
            {!compact && (
                <div className="mb-1 flex items-center gap-2 border-b border-hairline pb-1.5">
                    <span className="min-w-0 flex-1 font-ui text-[11px] font-semibold text-ink-muted">Заказ</span>
                    <span className="min-w-0 flex-1 font-ui text-[11px] font-semibold text-ink-muted">Основание</span>
                    <span className={cn(SUM_COL, 'font-ui text-[11px] font-semibold text-ink-muted')}>Начислено, ₽</span>
                </div>
            )}

            {visible.map((source, index) => {
                const basis = source.itemName ?? getSourceTypeLabel(source.type)
                return compact ? (
                    <div
                        key={`${source.type}-${source.id}-${index}`}
                        className="flex flex-col gap-0.5 border-b border-hairline py-2 last:border-b-0"
                    >
                        <div className="flex items-center gap-2">
                            {source.link ? (
                                <a
                                    href={source.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="min-w-0 flex-1 truncate font-ui text-xs font-semibold text-info-ink hover:underline"
                                >
                                    {source.label ?? `#${source.id}`}
                                </a>
                            ) : (
                                <span className="min-w-0 flex-1 truncate font-ui text-xs font-semibold text-ink">
                                    {source.label ?? `#${source.id}`}
                                </span>
                            )}
                            {source.amount !== undefined && (
                                <span className="shrink-0 font-ui text-xs font-bold text-ink tabular-nums">
                                    {formatCurrency(source.amount)}
                                </span>
                            )}
                        </div>
                        <span className="truncate font-ui text-[11px] text-ink-muted">{basis}</span>
                    </div>
                ) : (
                    <div
                        key={`${source.type}-${source.id}-${index}`}
                        className="flex items-center gap-2 border-b border-hairline py-2 last:border-b-0"
                    >
                        <span className="min-w-0 flex-1">
                            {source.link ? (
                                <a
                                    href={source.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block truncate font-ui text-xs font-semibold text-info-ink hover:underline"
                                >
                                    {source.label ?? `#${source.id}`}
                                </a>
                            ) : (
                                <span className="block truncate font-ui text-xs font-semibold text-ink">
                                    {source.label ?? `#${source.id}`}
                                </span>
                            )}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-ui text-xs text-ink-muted">{basis}</span>
                        <span className={cn(SUM_COL, 'font-ui text-xs font-bold text-ink tabular-nums')}>
                            {source.amount !== undefined ? formatCurrency(source.amount) : '—'}
                        </span>
                    </div>
                )
            })}

            {hiddenCount > 0 && (
                <div
                    className={cn(
                        'flex items-center gap-2 border-hairline pt-2',
                        !compact && 'border-t',
                        compact && 'justify-between border-t mt-1',
                    )}
                >
                    <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="flex min-w-0 items-center gap-1 font-ui text-xs font-semibold text-info-ink hover:underline"
                    >
                        ещё {hiddenCount} {pluralizeSources(hiddenCount)}
                        <ChevronRight className="size-3.5 shrink-0" />
                    </button>
                    <span
                        className={cn(
                            compact ? 'shrink-0' : cn(SUM_COL, 'ml-auto'),
                            'font-ui text-xs font-bold text-ink-muted tabular-nums',
                        )}
                    >
                        {formatCurrency(hiddenTotal)}
                    </span>
                </div>
            )}
        </div>
    )
}

export { AccrualLineSources }
