import type { ServiceAnalyticsEntry } from '@/kernel/types'
import { cn } from '@/shared/lib/tw'
import { barWidthPercent } from '@/features/ServicesTable/model/format.ts'
import { formatOptionalColumnValue, OPTIONAL_COLUMNS, type ColumnVisibility } from '@/features/ServicesTable/model/columns.ts'
import { SparklineCell } from '@/features/ServicesTable/ui/SparklineCell.tsx'

type Props = {
    rows: ServiceAnalyticsEntry[]
    /** Индекс первой строки этой страницы в отфильтрованном списке — чтобы "#" считался сквозным
     * по всем страницам, а не заново с 1 на каждой. */
    startIndex: number
    maxCount: number
    columnVisibility: ColumnVisibility
}

/** Десктоп-таблица (Pencil: `h7eHG` → `tmW21` "Table Section"). Опциональные денежные колонки
 * рендерятся в фиксированном порядке из `OPTIONAL_COLUMNS`, отфильтрованном по `columnVisibility` —
 * скрытая колонка просто не рендерится, остальные не переставляются. Бейдж варианта (OEM/AASP/HQ)
 * в ячейке "Услуга" убран — суффикс варианта и так виден прямо в `serviceName` ("... | OEM"),
 * отдельный чип дублировал бы ту же информацию. `parseServiceVariant`/`Chip` остаются нужны только
 * для вкладок-фильтра (`ServicesTableHeader`), не для самой строки. */
export function ServicesTableDesktop({ rows, startIndex, maxCount, columnVisibility }: Props) {
    const columns = OPTIONAL_COLUMNS.filter((column) => columnVisibility[column.id])

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
                <thead>
                    <tr className="h-11 bg-canvas">
                        <th className="w-9 px-4 font-ui text-[11.5px] font-bold text-ink">#</th>
                        <th className="min-w-[220px] px-2 font-ui text-[11.5px] font-bold text-ink">Услуга</th>
                        <th className="w-[108px] px-2 font-ui text-[11.5px] font-bold text-ink">Продажи</th>
                        <th className="w-[112px] px-2 font-ui text-[11.5px] font-bold text-ink">Тренд</th>
                        {columns.map((column) => (
                            <th
                                key={column.id}
                                className="w-[128px] px-4 text-right font-ui text-[11.5px] font-bold text-ink"
                            >
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => {
                        const isLast = idx === rows.length - 1
                        const barWidth = barWidthPercent(row.totalCount, maxCount)

                        return (
                            <tr
                                key={row.serviceId}
                                className={cn(
                                    'h-14 transition-colors hover:bg-row-selected',
                                    !isLast && 'border-b border-hairline',
                                )}
                            >
                                <td className="px-4 align-middle text-[13px] text-ink-faint tabular-nums">
                                    {startIndex + idx + 1}
                                </td>
                                <td className="px-2 align-middle">
                                    <span
                                        className="block truncate text-[14px] font-medium text-ink"
                                        title={row.serviceName}
                                    >
                                        {row.serviceName}
                                    </span>
                                </td>
                                <td className="px-2 align-middle">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[14px] font-semibold text-ink tabular-nums">
                                            {row.totalCount}
                                        </span>
                                        <div className="h-[5px] w-16 overflow-hidden rounded-full bg-hairline">
                                            <div
                                                className="h-full rounded-full bg-brand-strong"
                                                style={{ width: `${barWidth}%` }}
                                            />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-2 align-middle">
                                    <SparklineCell breakdown={row.breakdown} gradientId={`trend-${row.serviceId}`} />
                                </td>
                                {columns.map((column) => {
                                    const { text, colorClass } = formatOptionalColumnValue(row, column)
                                    return (
                                        <td key={column.id} className="px-4 align-middle text-right">
                                            <span className={cn('text-[14px] font-medium tabular-nums', colorClass)}>
                                                {text}
                                            </span>
                                        </td>
                                    )
                                })}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
