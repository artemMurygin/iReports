import { Target } from 'lucide-react'
import type { SalesPerformanceSummary } from 'ireports-contracts'

import { formatCurrency, formatNumber, formatPeriodLabel } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

export type SalesPlanCardProps = {
    label: string
    period: string
    isPlanApproved: boolean
    salesPerformance: SalesPerformanceSummary
    className?: string
}

/** Тот же порог-к-цвету, что и `shared/ui-kit/molecules/CellProgress.tsx`/`PlanCard.tsx` (оба уже
 * дублируют этот однострочник вместо общего экспорта из `ui-kit` — см. их комментарии); третья
 * копия здесь того же приёма, а не новая договорённость. */
function progressToneClassName(percent: number) {
    if (percent >= 100) return 'bg-brand-strong'
    if (percent >= 70) return 'bg-[#7fcb4b]'
    if (percent >= 40) return 'bg-warn'
    return 'bg-danger'
}

/** Прогноз ≥100% — зелёный (перевыполнит план), иначе выполнение <80% — оранжевый (риск не
 * выполнить план), иначе нейтральный приглушённый — см. задачу и Pencil `Q3K5O`/`jdMCD`. */
function performanceTextClassName(percentCompletion: number, forecastPercent: number) {
    if (forecastPercent >= 100) return 'text-ok-ink'
    if (percentCompletion < 80) return 'text-warn-ink'
    return 'text-ink-muted'
}

/**
 * Pencil: `Q3K5O`/`jdMCD` ("План продаж · Сервис"/"План продаж · Магазин") — в мокапе карточка
 * показывает НЕСКОЛЬКО строк-категорий (например, у "Магазина" — iPhone/Apple Watch/Аксессуары/
 * Mac/iPad, каждая — своя строка с прогрессом). Реальный контракт этого не даёт: `salesPerformance`
 * (`salesPerformanceSummarySchema`, `directionSalaryReportSchema.salesPerformance`) — это ОДНА
 * сводка на направление (`category: string | null` — одно значение, не список), а не массив
 * категорий. Карточка поэтому рендерит одну строку показателей вместо мокапа с несколькими;
 * `category === null` (сводка ещё не разбита по категориям на этом этапе) подписывается как «Все
 * категории».
 *
 * Прогнозный % контракт не отдаёт готовым числом (только `plan.turnover`/`prognose.turnover`) —
 * выводится как `prognose.turnover / plan.turnover * 100`, это законное отношение реальных полей,
 * а не выдумка. Строка «Маржа» — добавление сверх мокапа: контракт параллельно отдаёт
 * `plan.margin`/`fact.margin`/`prognose.margin`, которые сама карточка мокапа не визуализирует (там
 * ровно одна метрика на строку категории), но раз данные реальные и уже загружены — показываем и
 * их, тем же визуальным приёмом, что и margin-row в `shared/ui-kit/molecules/PlanCard.tsx`.
 */
export function SalesPlanCard({ label, period, isPlanApproved, salesPerformance, className }: SalesPlanCardProps) {
    const { category, plan, fact, prognose, percentCompletion } = salesPerformance
    const remaining = plan.turnover - fact.turnover
    const forecastPercent = plan.turnover === 0 ? 0 : Math.round((prognose.turnover / plan.turnover) * 100)
    const marginPercent = plan.margin === 0 ? 0 : Math.round((fact.margin / plan.margin) * 100)
    const textClassName = performanceTextClassName(percentCompletion, forecastPercent)

    return (
        <div
            data-slot="sales-plan-card"
            className={cn('flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-4', className)}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <Target className="size-4 shrink-0 text-ink-muted" />
                    <span className="truncate font-ui text-[15px] font-bold text-ink">План продаж · {label}</span>
                </div>
                <span
                    className={cn(
                        'shrink-0 rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                        isPlanApproved ? 'bg-brand-soft text-ok-ink' : 'bg-warn-soft text-warn-ink',
                    )}
                >
                    {isPlanApproved ? 'Утверждён' : 'Не утверждён'}
                </span>
            </div>

            <span className="font-ui text-xs text-ink-muted">{formatPeriodLabel(period)}</span>

            <div className="flex flex-col gap-2 border-t border-hairline pt-3">
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-ui text-sm font-semibold text-ink">{category ?? 'Все категории'}</span>
                    <span className="shrink-0 font-ui text-xs text-ink-muted">
                        {remaining > 0 ? `осталось ${formatCurrency(remaining)}` : 'план выполнен'}
                    </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-hairline">
                    <div
                        className={cn('h-full rounded-full', progressToneClassName(percentCompletion))}
                        style={{ width: `${Math.max(0, Math.min(100, percentCompletion))}%` }}
                    />
                </div>

                <span className={cn('font-ui text-xs font-semibold', textClassName)}>
                    {Math.round(percentCompletion)}% · прогноз {forecastPercent}%
                </span>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2.5">
                <span className="shrink-0 font-ui text-xs text-ink-muted">Маржа</span>
                <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-ui text-xs text-ink-muted">
                        {formatNumber(fact.margin)} из {formatNumber(plan.margin)}
                    </span>
                    <div className="h-[5px] w-14 shrink-0 overflow-hidden rounded-full bg-hairline">
                        <div
                            className="h-full rounded-full bg-[#c9c9cc]"
                            style={{ width: `${Math.max(0, Math.min(100, marginPercent))}%` }}
                        />
                    </div>
                    <span className="shrink-0 font-ui text-xs font-medium text-ink-muted">{marginPercent}%</span>
                </div>
            </div>
        </div>
    )
}
