import { useMemo } from 'react'
import { Target } from 'lucide-react'
import type { SalesPerformanceSummary } from 'ireports-contracts'

import { formatCurrency, useShopCategoryNames } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import { formatSalesPlanNote } from '../model/salesPlanNote.ts'

export type SalesPlanCardV2Props = {
    label: string
    period: string
    isPlanApproved: boolean
    /** Одна строка на каждую строку плана отдела за период — см.
     * `DirectionReportVM.salesPerformance`'s комментарий (0/1 у "Сервис", несколько категорий у
     * "Магазин"). */
    salesPerformance: SalesPerformanceSummary[]
    className?: string
}

const ALL_CATEGORIES_LABEL = 'Все категории'

/** Тот же порог-к-цвету, что и `shared/ui-kit/molecules/CellProgress.tsx`/`PlanCard.tsx`/старый
 * `pages/SalaryReport/ui/SalesPlanCard.tsx` — уже задокументированное в них как переиспользуемый,
 * но не вынесенный в общий экспорт приём (см. их комментарии); эта копия — по той же причине
 * («`pages` не может импортировать другую `pages`», а `ui-kit`'s версия жёстко пишет свой процент
 * рядом с баром, что не подходит под "Caption" новой раскладки). */
function progressToneClassName(percent: number) {
    if (percent >= 100) return 'bg-brand-strong'
    if (percent >= 70) return 'bg-[#7fcb4b]'
    if (percent >= 40) return 'bg-warn'
    return 'bg-danger'
}

function performanceTextClassName(percentCompletion: number, forecastPercent: number) {
    if (forecastPercent >= 100) return 'text-ok-ink'
    if (percentCompletion < 80) return 'text-warn-ink'
    return 'text-ink-muted'
}

type CategoryRowProps = {
    categoryName: string
    summary: SalesPerformanceSummary
    className?: string
}

/** Одна строка-категория (Pencil: `EG4ns`'s `q5aRpF`/`ZokWs`/`e0obH9` "Категория · …") — имя +
 * "осталось X ₽" сверху, трек прогресса, подпись "N% · прогноз M%" снизу. В отличие от старого
 * `SalesPlanCard`, здесь нет отдельной строки "Маржа" — новый макет её не показывает вовсе (ни на
 * одном из трёх сэмплов категорий), поэтому она не добавлена и сюда. */
function SalesPlanCategoryRow({ categoryName, summary, className }: CategoryRowProps) {
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
        </div>
    )
}

/**
 * Карточка плана продаж направления (Pencil: `wLtzp`'s `EG4ns`/`xPXmo` "План продаж ·
 * Сервис/Магазин" — десктопная правая колонка, `b63e8p`'s `qdvOQ`/`L7UBbf` — тот же узел в
 * мобильном стеке): шапка (иконка · "План продаж · {label}" · статус-чип "Утверждён"/"Не
 * утверждён" · нота с числом прошедших дней месяца, `formatSalesPlanNote`) над строками категорий
 * (`SalesPlanCategoryRow`, разделены hairline-границей). Функциональный аналог старого
 * `pages/SalaryReport/ui/SalesPlanCard.tsx` (тот же источник данных, та же сортировка категорий по
 * имени через `useShopCategoryNames`), переверстанный под новую раскладку.
 */
export function SalesPlanCardV2({ label, period, isPlanApproved, salesPerformance, className }: SalesPlanCardV2Props) {
    const categoryNameById = useShopCategoryNames()

    const rows = useMemo(() => {
        return salesPerformance
            .map((summary) => ({
                summary,
                categoryName:
                    summary.category === null
                        ? ALL_CATEGORIES_LABEL
                        : (categoryNameById.get(summary.category) ?? summary.category),
            }))
            .sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'ru'))
    }, [salesPerformance, categoryNameById])

    return (
        <div
            data-slot="sales-plan-card-v2"
            className={cn('flex flex-col rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="flex flex-col gap-0.5 px-4 pt-3.5 pb-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                        <Target className="size-3.5 shrink-0 text-ink-muted" />
                        <span className="truncate font-ui text-[13px] font-bold text-ink">План продаж · {label}</span>
                    </span>
                    <span
                        className={cn(
                            'shrink-0 rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                            isPlanApproved ? 'bg-brand-soft text-ok-ink' : 'bg-warn-soft text-warn-ink',
                        )}
                    >
                        {isPlanApproved ? 'Утверждён' : 'Не утверждён'}
                    </span>
                </div>
                <span className="font-ui text-[11px] text-ink-muted">{formatSalesPlanNote(period)}</span>
            </div>

            <div className="flex flex-col gap-0 px-4 pb-3">
                {rows.map(({ summary, categoryName }, index) => (
                    <SalesPlanCategoryRow
                        key={summary.category ?? 'all'}
                        categoryName={categoryName}
                        summary={summary}
                        className={index > 0 ? 'border-t border-hairline' : undefined}
                    />
                ))}
            </div>
        </div>
    )
}
