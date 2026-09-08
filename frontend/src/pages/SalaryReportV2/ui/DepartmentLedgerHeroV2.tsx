import { Info } from 'lucide-react'
import type { FactPrognoseAmount } from 'ireports-contracts'

import { formatCurrency, formatPeriodLabel, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import { pluralizeEmployees } from '@/features/SalaryReportData'

import { getDeltaTone } from '../model/deltaTone.ts'
import { buildDirectionSplit } from '../model/directionSplit.ts'
import type { DepartmentDirectionBreakdown } from '../model/useDepartmentSalaryReportAll.ts'

import { DeltaBadge } from './DeltaBadge.tsx'

/** Цвет сегмента/точки-легенды по направлению — Pencil-диф "Split Bar + Legend": Сервис
 * `$brand-strong`, Магазин `$info-ink` (не `$violet-ink`, который использует `DOT_CLASS` строк
 * правил в `DepartmentEmployeeGroupV2` — разные узлы макета, разные токены по факту `Get`). */
const SPLIT_SEGMENT_CLASS = {
    service: { bar: 'bg-brand-strong', dot: 'bg-brand-strong' },
    shop: { bar: 'bg-info-ink', dot: 'bg-info-ink' },
} as const

export type DepartmentLedgerHeroV2Props = {
    total: FactPrognoseAmount
    employeeCount: number
    departmentName: string | null
    period: string
    isClosed: boolean
    /** Суммы по направлениям для Split Bar + Legend (Pencil `eMEyq/I3gfR1`+`eMEyq/nC8in`) — `null`,
     * когда показывать нечего: вкладка направления не «Все» (у одиночного направления разбивка не
     * несёт смысла) или сумма факта по обоим направлениям равна 0 (см. `buildDirectionSplit`).
     * Родитель (`DepartmentLedgerV2`) уже решает, когда передавать не-`null` значение — этот
     * компонент только рендерит то, что получил. */
    directionBreakdown: DepartmentDirectionBreakdown | null
    className?: string
}

/**
 * Герой-строка карточки-гроссбуха («Итого», Pencil `U5nJr`/`fCj1g`) — общая сумма отдела слева
 * (факт), прогноз до конца месяца справа с бейджем-дельтой. Замена отдельной `DepartmentTotalsKpi`
 * (две `KpiCard` рядом) старого дизайна — здесь это верхняя строка единой карточки, не отдельный
 * компонент над таблицей. Ниже, под этой строкой, — опциональная разбивка Сервис/Магазин (Split Bar
 * + Legend), см. `directionBreakdown`.
 */
export function DepartmentLedgerHeroV2({
    total,
    employeeCount,
    departmentName,
    period,
    isClosed,
    directionBreakdown,
    className,
}: DepartmentLedgerHeroV2Props) {
    const periodLabel = formatPeriodLabel(period)
    const prognoseValue = total.prognose ?? total.fact
    const delta = total.prognose !== null ? total.prognose - total.fact : 0

    const noteParts = [pluralizeEmployees(employeeCount), departmentName, periodLabel].filter(Boolean)
    const splitSegments = directionBreakdown ? buildDirectionSplit(directionBreakdown) : null

    return (
        <div
            data-slot="department-ledger-hero-v2"
            className={cn('flex flex-col gap-3 border-b border-hairline p-4 md:gap-4 md:p-5', className)}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-ui text-[11px] font-semibold text-ink-muted">Начислено всего · факт</span>
                    <span className="font-display text-[28px] font-bold tracking-[-0.4px] text-ink">
                        {formatCurrency(total.fact)}
                    </span>
                    <span className="truncate font-ui text-xs text-ink-muted">{noteParts.join(' · ')}</span>
                </div>

                <div className="flex flex-col gap-1 sm:items-end">
                    <span className="flex items-center gap-1.5 font-ui text-[11px] font-semibold text-ink-muted">
                        Прогноз до конца месяца
                        <Info className="size-[13px] shrink-0" />
                    </span>
                    <span className="font-display text-lg font-bold text-ink-muted md:text-xl">
                        {formatCurrency(prognoseValue)}
                    </span>
                    <DeltaBadge tone={getDeltaTone(delta, isClosed)}>
                        {isClosed ? 'Месяц закрыт' : `${formatSignedCurrency(delta)} к факту`}
                    </DeltaBadge>
                </div>
            </div>

            {splitSegments && (
                <div data-slot="department-ledger-hero-split" className="flex flex-col gap-1.5">
                    <div className="flex h-2 w-full gap-[3px]">
                        {splitSegments.map((segment, index) => (
                            <span
                                key={segment.direction}
                                style={{ width: `${segment.percent}%` }}
                                className={cn(
                                    'h-full',
                                    SPLIT_SEGMENT_CLASS[segment.direction].bar,
                                    index === 0 && 'rounded-l-[4px]',
                                    index === splitSegments.length - 1 && 'rounded-r-[4px]',
                                )}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {splitSegments.map((segment) => (
                            <span
                                key={segment.direction}
                                className="flex items-center gap-1.5 font-ui text-xs text-ink-muted"
                            >
                                <span className={cn('size-1.5 shrink-0 rounded-full', SPLIT_SEGMENT_CLASS[segment.direction].dot)} />
                                {segment.label} · {formatCurrency(segment.amount)} · {segment.percent}%
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
