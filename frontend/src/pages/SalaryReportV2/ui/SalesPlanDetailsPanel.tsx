import { useMemo } from 'react'
import type { SalesPerformanceSummary } from 'ireports-contracts'

import { formatCurrency, useShopCategoryNames } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { SidePanel } from '@/shared/ui-kit/organisms/SidePanel.tsx'

import { formatSalesPlanNote } from '../model/salesPlanNote.ts'

import { SalesPlanCategoryRow } from './SalesPlanCategoryRow.tsx'

export type SalesPlanDetailsPanelProps = {
    label: string
    period: string
    isPlanApproved: boolean
    /** Все строки плана направления за период — та же форма, что и `DirectionReportVM.salesPerformance`
     * (0/1 у "Сервис", несколько категорий у "Магазин") — панель показывает ВСЕ, в отличие от
     * бенто-тизера направления, который ограничивается компактной сводкой. */
    salesPerformance: SalesPerformanceSummary[]
    open: boolean
    onClose: () => void
}

const ALL_CATEGORIES_LABEL = 'Все категории'

/**
 * Панель детализации плана продаж направления (Pencil: «Вариант C · План продаж (панель)» `z8SOOH`
 * десктоп / «Вариант C · Моб. · План продаж» `Y37PA6` мобайл) — раскрытие мини-тизера плана из
 * бенто-карточки направления (ссылка «Подробнее»). Тот же `SidePanel`, что и остальные панели этой
 * страницы, не новый drawer.
 *
 * Hero — суммарная Выручка и Маржа (факт) по всем `salesPerformance[]`. Тело — по секции на каждую
 * категорию через переиспользованный `SalesPlanCategoryRow` (тот же компонент, что и мини-тизер
 * `SalesPlanCardV2`, вынесенный в `SalesPlanCategoryRow.tsx` именно для того, чтобы не заводить
 * вторую копию этой логики здесь). Footer — «Выполнение плана X%» по обороту (факт/план), 0% при
 * нулевом плане (деление на 0 не заменяется на 100%/NaN).
 */
export function SalesPlanDetailsPanel({
    label,
    period,
    isPlanApproved,
    salesPerformance,
    open,
    onClose,
}: SalesPlanDetailsPanelProps) {
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

    const totalFactTurnover = salesPerformance.reduce((sum, row) => sum + row.fact.turnover, 0)
    const totalFactMargin = salesPerformance.reduce((sum, row) => sum + row.fact.margin, 0)
    const totalPlanTurnover = salesPerformance.reduce((sum, row) => sum + row.plan.turnover, 0)
    const planCompletionPercent =
        totalPlanTurnover === 0 ? 0 : Math.round((totalFactTurnover / totalPlanTurnover) * 100)

    return (
        <SidePanel
            open={open}
            onOpenChange={(nextOpen) => !nextOpen && onClose()}
            title={`План продаж · ${label}`}
            footer={
                <div className="flex items-center justify-between gap-3">
                    <span className="font-ui text-xs font-semibold text-ink-muted">Выполнение плана</span>
                    <span className="font-ui text-sm font-bold text-ink tabular-nums">{planCompletionPercent}%</span>
                </div>
            }
        >
            <div className="flex flex-col gap-3 border-b border-hairline p-5">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-ui text-[11px] text-ink-muted">{formatSalesPlanNote(period)}</span>
                    <span
                        className={cn(
                            'shrink-0 rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                            isPlanApproved ? 'bg-brand-soft text-ok-ink' : 'bg-warn-soft text-warn-ink',
                        )}
                    >
                        {isPlanApproved ? 'Утверждён' : 'Не утверждён'}
                    </span>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1">
                        <span className="font-ui text-[11px] font-semibold text-ink-muted">Выручка · факт</span>
                        <span className="font-display text-2xl font-bold tracking-[-0.3px] text-ink tabular-nums">
                            {formatCurrency(totalFactTurnover)}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="font-ui text-[11px] font-semibold text-ink-muted">Маржа · факт</span>
                        <span className="font-display text-2xl font-bold tracking-[-0.3px] text-ink tabular-nums">
                            {formatCurrency(totalFactMargin)}
                        </span>
                    </div>
                </div>
            </div>

            {rows.length === 0 ? (
                <p className="px-5 py-4 text-center font-ui text-xs text-ink-muted">Нет данных плана продаж.</p>
            ) : (
                <div className="flex flex-col gap-0 px-5 pb-4">
                    {rows.map(({ summary, categoryName }, index) => (
                        <SalesPlanCategoryRow
                            key={summary.category ?? 'all'}
                            categoryName={categoryName}
                            summary={summary}
                            className={index > 0 ? 'border-t border-hairline' : undefined}
                        />
                    ))}
                </div>
            )}
        </SidePanel>
    )
}
