import { useMemo } from 'react'
import { X } from 'lucide-react'
import type { SalesPerformanceSummary } from 'ireports-contracts'

import { formatCurrency, useShopCategoryNames } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { SidePanel } from '@/shared/ui-kit/organisms/SidePanel.tsx'

import type { SalaryDirection } from '@/features/SalaryReportData'

import { pluralizeCategories } from '../model/pluralizeCategories.ts'
import { formatSalesPlanNote } from '../model/salesPlanNote.ts'

import { DOT_CLASS } from './DirectionSourceCard.tsx'
import { SalesPlanTableRow } from './SalesPlanTableRow.tsx'

export type SalesPlanDetailsPanelProps = {
    label: string
    direction: SalaryDirection
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

function sumMetric(rows: SalesPerformanceSummary[], key: 'plan' | 'fact' | 'prognose', metric: 'turnover' | 'margin') {
    return rows.reduce((sum, row) => sum + row[key][metric], 0)
}

/** `clamp(факт/план * 100, 0, 100)`, план `0` — считается полностью выполненным (100%) только если
 * факт тоже не нулевой, иначе трек остаётся пустым (тот же приём, что и `DirectionSourceCard`'s
 * `calcRoleProgressPercent`, применённый к парам план/факт вместо факт/прогноз). */
function calcPlanPercent(fact: number, plan: number): number {
    if (plan <= 0) return fact > 0 ? 100 : 0
    return Math.max(0, Math.min(100, Math.round((fact / plan) * 100)))
}

type HeroMetricProps = {
    label: string
    factValue: number
    planValue: number
    prognoseValue: number
}

/** Одна из двух KPI-колонок шапки (Pencil: `BvW3A`'s `PGfzO` "Hero" → `EmtHL` "ВЫРУЧКА"/`kRWtT`
 * "МАРЖА") — крупное факт-число, подпись плана, трек факт/план и нота "N% плана · прогноз M". */
function HeroMetric({ label, factValue, planValue, prognoseValue }: HeroMetricProps) {
    const percent = calcPlanPercent(factValue, planValue)

    return (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-ui text-[9px] font-semibold tracking-[0.6px] text-ink-faint">{label}</span>
            <span className="font-display text-[22px] font-bold tracking-[-0.3px] text-ink tabular-nums">
                {formatCurrency(factValue)}
            </span>
            <span className="font-ui text-[11px] text-ink-muted">план {formatCurrency(planValue)}</span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
                <div className="h-full rounded-full bg-brand-strong" style={{ width: `${percent}%` }} />
            </div>
            <span className="font-ui text-[10px] text-ink-muted">
                {percent}% плана · прогноз {formatCurrency(prognoseValue)}
            </span>
        </div>
    )
}

/**
 * Панель детализации плана продаж направления (Pencil: `design/sallary-first-iteration.pen`, узел
 * `BvW3A` "Панель · План продаж") — раскрытие мини-тизера плана из бенто-карточки направления
 * (ссылка «Подробнее»). Тот же `SidePanel`, что и остальные панели этой страницы, но с собственной
 * шапкой (`srOnlyTitle` вместо `title` — тот же приём, что и `TaskDetailsPanel`/`TaskStatusCard`):
 * макету нужна вторая строка меты под заголовком, которую `SidePanel`'s готовый слот не умеет.
 *
 * Hero — суммарные Выручка и Маржа (факт/план/прогноз) по всем `salesPerformance[]`, с собственным
 * прогресс-баром на каждую метрику. Тело — плотная таблица с общим заголовком колонок
 * (Категория/План/Факт/Прогноз) и построчной зеброй `bg-surface`/`bg-canvas` (`SalesPlanTableRow`),
 * без индивидуального прогресс-бара на каждую категорию — в отличие от мини-тизера `SalesPlanCardV2`,
 * этой панели нужна не карточка на категорию, а компактная сверка всех категорий разом. Строка
 * "Итого" — та же `SalesPlanTableRow` с `isTotal`, выделена `brand-soft`. Footer — «Выполнение
 * плана X%» по обороту (факт/план), 0% при нулевом плане (деление на 0 не заменяется на 100%/NaN).
 */
export function SalesPlanDetailsPanel({
    label,
    direction,
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

    const totalPlanTurnover = sumMetric(salesPerformance, 'plan', 'turnover')
    const totalFactTurnover = sumMetric(salesPerformance, 'fact', 'turnover')
    const totalPrognoseTurnover = sumMetric(salesPerformance, 'prognose', 'turnover')
    const totalPlanMargin = sumMetric(salesPerformance, 'plan', 'margin')
    const totalFactMargin = sumMetric(salesPerformance, 'fact', 'margin')
    const totalPrognoseMargin = sumMetric(salesPerformance, 'prognose', 'margin')

    const totalSummary: SalesPerformanceSummary = {
        department: 0,
        category: null,
        plan: { turnover: totalPlanTurnover, margin: totalPlanMargin },
        fact: { turnover: totalFactTurnover, margin: totalFactMargin },
        prognose: { turnover: totalPrognoseTurnover, margin: totalPrognoseMargin },
        percentCompletion: calcPlanPercent(totalFactTurnover, totalPlanTurnover),
    }

    const planCompletionPercent = calcPlanPercent(totalFactTurnover, totalPlanTurnover)

    return (
        <SidePanel
            open={open}
            onOpenChange={(nextOpen) => !nextOpen && onClose()}
            srOnlyTitle={`План продаж · ${label}`}
            className="md:w-[552px]"
            footer={
                <div className="flex items-center justify-end gap-3">
                    <span className="font-ui text-xs font-semibold text-ink-muted">Выполнение плана</span>
                    <span className="font-display text-base font-bold text-ink tabular-nums">
                        {planCompletionPercent}%
                    </span>
                </div>
            }
        >
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('size-2 shrink-0 rounded-full', DOT_CLASS[direction])} aria-hidden />
                            <span className="truncate font-display text-base font-bold text-ink">
                                План продаж · {label}
                            </span>
                            <span
                                className={cn(
                                    'shrink-0 rounded-full px-[7px] py-0.5 font-ui text-[10px] font-semibold whitespace-nowrap',
                                    isPlanApproved ? 'bg-brand-soft text-ok-ink' : 'bg-warn-soft text-warn-ink',
                                )}
                            >
                                {isPlanApproved ? 'Утверждён' : 'Не утверждён'}
                            </span>
                        </div>
                        <span className="truncate font-ui text-[11px] text-ink-muted">
                            Направление «{label}» · {pluralizeCategories(rows.length)} · {formatSalesPlanNote(period)}
                        </span>
                    </div>
                    <IconButton aria-label="Закрыть" onClick={onClose} className="shrink-0">
                        <X />
                    </IconButton>
                </div>

                <div className="flex items-stretch gap-4 border-b border-hairline px-5 py-4">
                    <HeroMetric
                        label="ВЫРУЧКА"
                        factValue={totalFactTurnover}
                        planValue={totalPlanTurnover}
                        prognoseValue={totalPrognoseTurnover}
                    />
                    <div className="w-px shrink-0 bg-hairline" aria-hidden />
                    <HeroMetric
                        label="МАРЖА"
                        factValue={totalFactMargin}
                        planValue={totalPlanMargin}
                        prognoseValue={totalPrognoseMargin}
                    />
                </div>

                {rows.length === 0 ? (
                    <p className="px-5 py-4 text-center font-ui text-xs text-ink-muted">Нет данных плана продаж.</p>
                ) : (
                    <div className="flex min-h-0 flex-1 flex-col justify-between">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 bg-ink px-5 py-2">
                                <span className="min-w-0 flex-1 truncate font-ui text-[10px] font-bold tracking-[0.4px] text-surface">
                                    Категория
                                </span>
                                <span className="w-[72px] shrink-0 text-right font-ui text-[10px] font-bold tracking-[0.4px] text-surface">
                                    План
                                </span>
                                <span className="w-[72px] shrink-0 text-right font-ui text-[10px] font-bold tracking-[0.4px] text-surface">
                                    Факт
                                </span>
                                <span className="w-[72px] shrink-0 text-right font-ui text-[10px] font-bold tracking-[0.4px] text-surface">
                                    Прогноз
                                </span>
                            </div>

                            {rows.map(({ summary, categoryName }, index) => (
                                <SalesPlanTableRow
                                    key={summary.category ?? 'all'}
                                    categoryName={categoryName}
                                    summary={summary}
                                    className={index % 2 === 1 ? 'bg-canvas' : undefined}
                                />
                            ))}
                        </div>

                        <SalesPlanTableRow categoryName={`Итого · ${label}`} summary={totalSummary} isTotal />
                    </div>
                )}
            </div>
        </SidePanel>
    )
}
