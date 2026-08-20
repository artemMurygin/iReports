import { cn } from '@/shared/lib/tw'

import { employeesPlural } from '../model/identityLabels.ts'
import type { IdentityCoverage } from '../model/useEmployeeIdentities.ts'

type CoverageSegment = {
    key: keyof Omit<IdentityCoverage, 'total'>
    /** Токен заливки полосы и точки в легенде — один и тот же цвет на оба места. */
    color: string
    label: string
}

// Порядок сегментов — от «всё хорошо» к «зарплата не считается», как в макете.
const SEGMENTS: CoverageSegment[] = [
    { key: 'both', color: 'bg-brand-strong', label: 'опознаны в обеих системах' },
    { key: 'partial', color: 'bg-warn', label: 'только в одной' },
    { key: 'none', color: 'bg-danger', label: 'ни в одной — зарплата не считается' },
]

export type CoverageCardProps = {
    coverage: IdentityCoverage
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, фрейм `CpVvw`, карточка «Покрытие ERP» —
 * заголовок + счётчик сотрудников Bitrix24, полоса 10px из трёх сегментов и легенда.
 *
 * Ширина сегмента пропорциональна количеству сотрудников в нём: `flex-grow` от самого
 * количества при `flex-basis: 0` даёт ровно долю от общего числа, но, в отличие от
 * `width: N%`, само учитывает зазоры 3px между сегментами — считать проценты за вычетом
 * гэпов не приходится. Сегменты с нулём не рендерятся вовсе: иначе от них остался бы
 * лишний зазор без заливки.
 */
function CoverageCard({ coverage, className }: CoverageCardProps) {
    const visibleSegments = SEGMENTS.filter((segment) => coverage[segment.key] > 0)

    return (
        <section
            data-slot="employee-identity-coverage"
            className={cn(
                'flex flex-col gap-[13px] rounded-xl border border-hairline bg-surface p-[15px] md:p-[18px]',
                className,
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-ink">Покрытие ERP</h2>
                <span className="font-ui text-xs text-ink-muted">
                    {coverage.total} {employeesPlural(coverage.total)} в Bitrix24
                </span>
            </div>

            <div className="flex h-[10px] gap-[3px] overflow-hidden rounded-[5px] bg-hairline">
                {visibleSegments.map((segment) => (
                    <span
                        key={segment.key}
                        style={{ flexGrow: coverage[segment.key], flexBasis: 0 }}
                        title={`${coverage[segment.key]} — ${segment.label}`}
                        className={cn('rounded-[5px]', segment.color)}
                    />
                ))}
            </div>

            <div className="flex flex-wrap gap-x-[26px] gap-y-2">
                {SEGMENTS.map((segment) => (
                    <div key={segment.key} className="flex items-center gap-2">
                        <span className={cn('size-2 shrink-0 rounded-full', segment.color)} />
                        <span className="font-ui text-sm font-semibold text-ink">{coverage[segment.key]}</span>
                        <span className="font-ui text-xs text-ink-muted">{segment.label}</span>
                    </div>
                ))}
            </div>
        </section>
    )
}

export { CoverageCard }
