import { CornerDownRight } from 'lucide-react'
import type { SalesPerformanceSummary } from 'ireports-contracts'

import { formatNumber } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

export type SalesPlanTableRowProps = {
    categoryName: string
    summary: SalesPerformanceSummary
    /** Строка "Итого" (Pencil: `RsJm8`) — фон `brand-soft` + верхняя граница `brand-border` вместо
     * зебры, обе метрики (Выручка/Маржа) целиком `ok-ink`. */
    isTotal?: boolean
    className?: string
}

/**
 * Одна строка-категория таблицы плана продаж (Pencil: `design/sallary-first-iteration.pen`, узел
 * `BvW3A` "Панель · План продаж" → `Y0Rdp`'s `GOuHM`/`cngER`/... "Категории", итог `RsJm8` "Итого").
 * Две подстроки на категорию — "Выручка" (имя категории + План/Факт/Прогноз, факт выделен жирным) и
 * "Маржа" (та же тройка колонок приглушённым цветом, с `CornerDownRight`, показывающим, что это
 * вложенная метрика выручки) — обе выровнены в общие 72px-колонки, те же, что и у заголовка
 * `SalesPlanTableHeader`.
 *
 * Отдельный компонент от `SalesPlanCategoryRow` (используется мини-тизером `SalesPlanCardV2` и
 * бенто-карточкой направления) — та раскладка (прогресс-бар + карточка План/Факт/Прогноз на
 * категорию) не то же самое, что этот плотный табличный ряд, и переиспользование привело бы к
 * ветвлению одного компонента на два визуально несовместимых режима.
 */
export function SalesPlanTableRow({ categoryName, summary, isTotal, className }: SalesPlanTableRowProps) {
    const { plan, fact, prognose } = summary

    return (
        <div
            data-slot="sales-plan-table-row"
            className={cn(
                'flex min-h-[55px] flex-col justify-center gap-[3px] px-5 py-2',
                isTotal ? 'border-t border-brand-border bg-brand-soft' : 'bg-surface',
                className,
            )}
        >
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        'min-w-0 flex-1 truncate font-ui text-xs',
                        isTotal ? 'font-bold text-ink' : 'font-semibold text-ink',
                    )}
                >
                    {categoryName}
                </span>
                <span
                    className={cn(
                        'w-[72px] shrink-0 text-right font-display text-xs tabular-nums',
                        isTotal ? 'font-bold text-ok-ink' : 'font-normal text-ink-muted',
                    )}
                >
                    {formatNumber(plan.turnover)}
                </span>
                <span
                    className={cn(
                        'w-[72px] shrink-0 text-right font-display text-xs font-bold tabular-nums text-ink',
                    )}
                >
                    {formatNumber(fact.turnover)}
                </span>
                <span
                    className={cn(
                        'w-[72px] shrink-0 text-right font-display text-xs tabular-nums',
                        isTotal ? 'font-bold text-ok-ink' : 'font-normal text-ink-muted',
                    )}
                >
                    {formatNumber(prognose.turnover)}
                </span>
            </div>

            <div className="flex items-center gap-1.5">
                <CornerDownRight className={cn('size-2.5 shrink-0', isTotal ? 'text-ok-ink' : 'text-ink-faint')} />
                <span
                    className={cn(
                        'min-w-0 flex-1 truncate font-ui text-[10px]',
                        isTotal ? 'font-semibold text-ok-ink' : 'font-normal text-ink-muted',
                    )}
                >
                    Маржа
                </span>
                <span
                    className={cn(
                        'w-[72px] shrink-0 text-right font-display text-[11px] tabular-nums',
                        isTotal ? 'font-semibold text-ok-ink' : 'font-normal text-ink-faint',
                    )}
                >
                    {formatNumber(plan.margin)}
                </span>
                <span
                    className={cn(
                        'w-[72px] shrink-0 text-right font-display text-[11px] font-semibold tabular-nums',
                        isTotal ? 'text-ok-ink' : 'text-ink',
                    )}
                >
                    {formatNumber(fact.margin)}
                </span>
                <span
                    className={cn(
                        'w-[72px] shrink-0 text-right font-display text-[11px] tabular-nums',
                        isTotal ? 'font-semibold text-ok-ink' : 'font-normal text-ink-faint',
                    )}
                >
                    {formatNumber(prognose.margin)}
                </span>
            </div>
        </div>
    )
}
