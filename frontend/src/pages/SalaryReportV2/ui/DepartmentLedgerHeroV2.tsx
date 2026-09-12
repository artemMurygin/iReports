import type { FactPrognoseAmount } from 'ireports-contracts'
import { formatCurrency, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { getDeltaTone } from '../model/deltaTone.ts'
import { DeltaBadge } from './DeltaBadge.tsx'

export type DepartmentLedgerHeroV2Props = {
    total: FactPrognoseAmount
    isClosed: boolean
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
    isClosed,
    className,
}: DepartmentLedgerHeroV2Props) {
    const prognoseValue = total.prognose ?? total.fact
    const delta = total.prognose !== null ? total.prognose - total.fact : 0

    return (
        <div
            data-slot="department-ledger-hero-v2"
            className={cn('flex flex-col gap-3 border-b border-hairline p-4 md:gap-4 md:p-5', className)}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-ui text-[11px] font-semibold text-ink-muted">Начислено всего на текущий момент</span>
                    <span className="font-display text-[28px] font-bold tracking-[-0.4px] text-ink">
                        {formatCurrency(total.fact)}
                    </span>
                </div>

                <div className="flex flex-col gap-1 sm:items-end">
                    <span className="flex items-center gap-1.5 font-ui text-[11px] font-semibold text-ink-muted">
                        Прогноз начисления за текущие продажи
                    </span>
                    <span className="font-display text-lg font-bold text-ink-muted md:text-xl">
                        {formatCurrency(prognoseValue)}
                    </span>
                    <DeltaBadge tone={getDeltaTone(delta, isClosed)}>
                        {isClosed ? 'Месяц закрыт' : `${formatSignedCurrency(delta)} к факту`}
                    </DeltaBadge>
                </div>
            </div>
        </div>
    )
}
