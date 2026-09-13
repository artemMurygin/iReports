import type { SalesPerformanceSummary } from 'ireports-contracts'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

export type SalesPlanCategoryRowProps = {
    categoryName: string
    summary: SalesPerformanceSummary
    className?: string
}

export type MetricRowProps = {
    label: string
    plan: number
    fact: number
    prognose: number
}

/** Тот же порог-к-цвету, что и `shared/ui-kit/molecules/CellProgress.tsx`/`PlanCard.tsx`/старый
 * `pages/SalaryReport/ui/SalesPlanCard.tsx` — уже задокументированное в них как переиспользуемый,
 * но не вынесенный в общий экспорт приём (см. их комментарии); эта копия — по той же причине
 * («`pages` не может импортировать другую `pages`», а `ui-kit`'s версия жёстко пишет свой процент
 * рядом с баром, что не подходит под "Caption" новой раскладки). Вынесено из `SalesPlanCardV2.tsx`
 * (тизер списка на 1 категорию) в отдельный файл, чтобы `SalesPlanDetailsPanel` (все категории
 * целиком) переиспользовало ту же строку/логику вместо копирования.
 */
export function progressToneClassName(percent: number) {
    if (percent >= 100) return 'bg-brand-strong'
    if (percent >= 70) return 'bg-[#7fcb4b]'
    if (percent >= 40) return 'bg-warn'
    return 'bg-danger'
}

export function performanceTextClassName(percentCompletion: number, forecastPercent: number) {
    if (forecastPercent >= 100) return 'text-ok-ink'
    if (percentCompletion < 80) return 'text-warn-ink'
    return 'text-ink-muted'
}

/** Одна строка метрики (Выручка/Маржа) в мини-таблице "План/Факт/Прогноз" под прогресс-баром
 * категории — тот же приём "узкая подпись слева + N выровненных вправо числовых колонок", что и
 * `RuleSourcesRail`'s строки источника, только без своей колонки под шеврон (здесь нечего
 * разворачивать). */
export function MetricRow({ label, plan, fact, prognose }: MetricRowProps) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 truncate font-ui text-[11px] text-ink-muted">{label}</span>
            <span className="flex-1 truncate text-right font-ui text-[11px] font-semibold text-ink tabular-nums">
                {formatCurrency(plan)}
            </span>
            <span className="flex-1 truncate text-right font-ui text-[11px] font-semibold text-ink tabular-nums">
                {formatCurrency(fact)}
            </span>
            <span className="flex-1 truncate text-right font-ui text-[11px] font-semibold text-ink-muted tabular-nums">
                {formatCurrency(prognose)}
            </span>
        </div>
    )
}

/** Одна строка-категория (Pencil: `EG4ns`'s `q5aRpF`/`ZokWs`/`e0obH9` "Категория · …") — имя +
 * "осталось X ₽" сверху, трек прогресса (по выручке), подпись "N% · прогноз M%", затем мини-таблица
 * "План/Факт/Прогноз" по Выручке и Марже (`MetricRow` ×2) снизу. В отличие от старого
 * `SalesPlanCard`, там отдельной строки "Маржа" не было вовсе (ни на одном из трёх сэмплов
 * категорий макета) — добавлена по прямому запросу поверх макета, вместе с явными числами
 * плана/факта/прогноза по обеим метрикам (раньше явно показывалась только выручка — "осталось X ₽"
 * и проценты прогресс-бара).
 *
 * Переиспользуется в двух местах: `SalesPlanCardV2` (мини-тизер направления, обычно только первая
 * категория) и `SalesPlanDetailsPanel` (все категории `salesPerformance[]` целиком) — извлечён сюда
 * ровно для того, чтобы обе стороны не расходились в этой логике.
 */
export function SalesPlanCategoryRow({ categoryName, summary, className }: SalesPlanCategoryRowProps) {
    const { plan, fact, prognose, percentCompletion } = summary
    const remaining = plan.turnover - fact.turnover
    const forecastPercent = plan.turnover === 0 ? 0 : Math.round((prognose.turnover / plan.turnover) * 100)
    const textClassName = performanceTextClassName(percentCompletion, forecastPercent)

    return (
        <div className={cn('flex flex-col gap-2 pt-3', className)}>
            <div className="flex items-center justify-between gap-2">
                <span className="truncate font-ui text-sm font-semibold text-ink">{categoryName}</span>
                <span className="shrink-0 font-ui text-xs text-ink-muted">
                    {remaining > 0 ? `осталось ${formatCurrency(remaining)}` : 'план выполнен'}
                </span>
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
                <div
                    className={cn('h-full rounded-full', progressToneClassName(percentCompletion))}
                    style={{ width: `${Math.max(0, Math.min(100, percentCompletion))}%` }}
                />
            </div>

            <span className={cn('font-ui text-xs font-semibold', textClassName)}>
                {Math.round(percentCompletion)}% · прогноз {forecastPercent}%
            </span>

            <div className="flex flex-col gap-1 rounded-lg bg-canvas px-2 py-1.5">
                <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0" aria-hidden />
                    <span className="flex-1 truncate text-right font-ui text-[10px] font-semibold text-ink-muted">
                        План
                    </span>
                    <span className="flex-1 truncate text-right font-ui text-[10px] font-semibold text-ink-muted">
                        Факт
                    </span>
                    <span className="flex-1 truncate text-right font-ui text-[10px] font-semibold text-ink-muted">
                        Прогноз
                    </span>
                </div>
                <MetricRow label="Выручка" plan={plan.turnover} fact={fact.turnover} prognose={prognose.turnover} />
                <MetricRow label="Маржа" plan={plan.margin} fact={fact.margin} prognose={prognose.margin} />
            </div>
        </div>
    )
}
