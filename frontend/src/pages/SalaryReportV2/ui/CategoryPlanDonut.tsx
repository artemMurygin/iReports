import { cn } from '@/shared/lib/tw'

export type CategoryPlanDonutProps = {
    label: string
    /** `percentCompletion` категории (факт/план по выручке) — внутреннее, более толстое кольцо
     * (Pencil: `uIerk`'s `F5780` "Факт", `$brand-strong`), тот же приоритет "факт — основной,
     * прогноз — вспомогательный", что и везде на этой странице. Не клэмпится для подписи в центре
     * (может быть выше 100%), клэмпится только сама дуга кольца. */
    factPercent: number
    /** Прогноз/план по выручке — внешнее, более тонкое кольцо (Pencil: `uIerk`'s `g5Eh3` "Прогноз",
     * светлее факта). */
    forecastPercent: number
    className?: string
}

const SIZE = 58
const CENTER = SIZE / 2
const OUTER_RADIUS = 26
const OUTER_STROKE = 3
const INNER_RADIUS = 20
const INNER_STROKE = 5

function ringOffset(radius: number, percent: number) {
    const circumference = 2 * Math.PI * radius
    const clamped = Math.max(0, Math.min(100, percent))
    return circumference * (1 - clamped / 100)
}

/**
 * Кольцевая мини-диаграмма категории плана продаж (Pencil: `design/sallary-first-iteration.pen`,
 * `YCxrT`'s `uIerk` "Donut" — два концентрических кольца: внешнее тонкое — прогноз, внутреннее
 * толще — факт, оба от 12 часов по часовой; в центре подпись фактом в процентах). Заменяет собой
 * ошибочно упрощённую до линейного прогресс-бара версию — по прямому запросу свериться с макетом
 * буквально для этого виджета (данные те же самые, что уже считает `SalesPlanCategoryRow`
 * `percentCompletion`/`forecastPercent`, никакой новой выдуманной метрики здесь нет).
 */
export function CategoryPlanDonut({ label, factPercent, forecastPercent, className }: CategoryPlanDonutProps) {
    return (
        <div
            data-slot="category-plan-donut"
            className={cn('flex w-[76px] shrink-0 flex-col items-center gap-1.5', className)}
        >
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
                <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={OUTER_RADIUS}
                    fill="none"
                    strokeWidth={OUTER_STROKE}
                    className="stroke-hairline"
                />
                <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={OUTER_RADIUS}
                    fill="none"
                    strokeWidth={OUTER_STROKE}
                    strokeLinecap="round"
                    className="stroke-brand-strong/40"
                    strokeDasharray={2 * Math.PI * OUTER_RADIUS}
                    strokeDashoffset={ringOffset(OUTER_RADIUS, forecastPercent)}
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                />
                <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={INNER_RADIUS}
                    fill="none"
                    strokeWidth={INNER_STROKE}
                    className="stroke-hairline"
                />
                <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={INNER_RADIUS}
                    fill="none"
                    strokeWidth={INNER_STROKE}
                    strokeLinecap="round"
                    className="stroke-brand-strong"
                    strokeDasharray={2 * Math.PI * INNER_RADIUS}
                    strokeDashoffset={ringOffset(INNER_RADIUS, factPercent)}
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                />
                <text
                    x={CENTER}
                    y={CENTER}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-ink font-ui text-[11px] font-bold tabular-nums"
                >
                    {Math.round(factPercent)}%
                </text>
            </svg>
            <span className="max-w-full truncate font-ui text-[11px] text-ink-muted">{label}</span>
        </div>
    )
}
