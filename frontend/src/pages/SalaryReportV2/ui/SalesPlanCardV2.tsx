import { useMemo } from 'react'
import { Target } from 'lucide-react'
import type { SalesPerformanceSummary } from 'ireports-contracts'

import { useShopCategoryNames } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import { formatSalesPlanNote } from '../model/salesPlanNote.ts'

import { SalesPlanCategoryRow } from './SalesPlanCategoryRow.tsx'

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

/**
 * Карточка плана продаж направления (Pencil: `wLtzp`'s `EG4ns`/`xPXmo` "План продаж ·
 * Сервис/Магазин" — десктопная правая колонка, `b63e8p`'s `qdvOQ`/`L7UBbf` — тот же узел в
 * мобильном стеке): шапка (иконка · "План продаж · {label}" · статус-чип "Утверждён"/"Не
 * утверждён" · нота с числом прошедших дней месяца, `formatSalesPlanNote`) над строками категорий
 * (`SalesPlanCategoryRow`, разделены hairline-границей). Функциональный аналог старого
 * `pages/SalaryReport/ui/SalesPlanCard.tsx` (тот же источник данных), переверстанный под новую
 * раскладку.
 *
 * Порядок строк — как пришло в `salesPerformance` (без пересортировки на клиенте): для `shop`
 * бэкенд уже отдаёт категории в сохранённом drag-and-drop порядке (`sortOrder` на
 * `SalesPlanTemplate`, см. `docs/sales-plan-row-drag-and-drop-reorder` — `GetShopSalesPerformanceService`
 * применяет тот же `ensureOrdered()`, что и страница `/sales-plan`), тем же путём, что и
 * `SalesPlanTable`/`SalesPlanCardList` этой фичи. Раньше здесь была своя сортировка по алфавиту
 * (`categoryName.localeCompare`) — убрана, чтобы порядок совпадал с тем, что задал пользователь на
 * `/sales-plan`, а не расходился с ним.
 */
export function SalesPlanCardV2({ label, period, isPlanApproved, salesPerformance, className }: SalesPlanCardV2Props) {
    const categoryNameById = useShopCategoryNames()

    const rows = useMemo(() => {
        return salesPerformance.map((summary) => ({
            summary,
            categoryName:
                summary.category === null
                    ? ALL_CATEGORIES_LABEL
                    : (categoryNameById.get(summary.category) ?? summary.category),
        }))
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
