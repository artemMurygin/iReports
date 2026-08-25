import { ChevronRight } from 'lucide-react'
import type { ServiceAnalyticsEntry } from '@/kernel/types'
import { cn } from '@/shared/lib/tw'
import { barWidthPercent, fmtMoney, profitColorClass } from '@/features/ServicesTable/model/format.ts'
import { TrendSparkline } from '@/features/ServicesTable/ui/TrendSparkline.tsx'

type Props = {
    row: ServiceAnalyticsEntry
    index: number
    maxCount: number
}

type MetricCellProps = {
    label: string
    value: string
    colorClass?: string
}

function MetricCell({ label, value, colorClass = 'text-ink' }: MetricCellProps) {
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-ink-muted">{label}</span>
            <span className={cn('text-[12.5px] font-semibold tabular-nums', colorClass)}>{value}</span>
        </div>
    )
}

/** Карточка услуги мобильного списка (Pencil: `aoOaU` → `slnFj` "Services Section" →
 * `UKBWU` "Service List"). Рендерит те же данные, что и строка десктоп-таблицы, в другой
 * разметке — общий отфильтрованный/пагинированный список строится один раз в `ServicesTable.tsx`. */
export function ServiceMobileCard({ row, index, maxCount }: Props) {
    const barWidth = barWidthPercent(row.totalCount, maxCount)

    return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-hairline bg-surface p-3.5">
            <div className="flex items-center gap-2.5">
                <span className="w-[18px] shrink-0 text-[11px] font-semibold text-ink-faint tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13.5px] leading-[1.3] font-semibold text-ink">{row.serviceName}</p>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] whitespace-nowrap text-ink-muted">{row.totalCount} продаж</span>
                        <div className="h-[5px] w-14 shrink-0 overflow-hidden rounded-full bg-hairline">
                            <div className="h-full rounded-full bg-brand-strong" style={{ width: `${barWidth}%` }} />
                        </div>
                    </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-faint" />
            </div>

            <TrendSparkline
                breakdown={row.breakdown}
                gradientId={`trend-mobile-${row.serviceId}`}
                width="100%"
                height={40}
                showTooltip={false}
                className="w-full"
            />

            <div className="h-px bg-hairline" />

            <div className="grid grid-cols-3 gap-2.5">
                <MetricCell label="Розн. цена" value={fmtMoney(row.retailPrice)} />
                <MetricCell label="Цена продажи" value={fmtMoney(row.avgServicePrice)} />
                <MetricCell label="Мастеру" value={fmtMoney(row.totalEngineerBonus)} />
                <MetricCell label="Средний чек" value={fmtMoney(row.avgOrderCheck)} />
                <MetricCell label="Выручка" value={fmtMoney(row.totalRevenue)} />
                <MetricCell
                    label="Прибыль"
                    value={fmtMoney(row.totalProfit)}
                    colorClass={profitColorClass(row.totalProfit)}
                />
            </div>
        </div>
    )
}
