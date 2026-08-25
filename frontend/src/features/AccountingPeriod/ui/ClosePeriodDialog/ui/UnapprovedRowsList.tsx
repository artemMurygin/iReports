import { CircleAlert } from 'lucide-react'
import type { UnapprovedSalesPlanRow } from 'ireports-contracts'

import { formatCurrency, formatPeriodLabel } from '@/shared/lib/format.ts'

export type UnapprovedRowDetails = { name: string; amount: number }

export type UnapprovedRowsListProps = {
    rows: UnapprovedSalesPlanRow[]
    period: string
    /** Название категории и сумма плана по id строки — из данных страницы плана продаж
     * (сводка close-preview несёт только `{ id, department, category }`). */
    rowDetailsById: Record<string, UnapprovedRowDetails>
    /** Название отдела Bitrix по id (справочник TargetDirectory) — подпись «· Отдел сервиса». */
    departmentNameById: Record<number, string>
    onApproveRow: (id: string) => void
    isApproving: boolean
}

/**
 * Перечень неутверждённых строк плана со ссылкой «Утвердить» у каждой (Pencil `KPPJ5`:
 * заголовок «Неутверждённые строки плана · июль 2026»). На десктопе строка в одну линию —
 * «Ремонт Apple · Отдел сервиса … 1 450 000 ₽ [Утвердить]»; на мобильном (Pencil `sAd8Z`)
 * строка в две линии — название сверху, «сумма · отдел» мельче под ней, кнопка остаётся
 * справа по центру строки. Название/сумма берутся из `rowDetailsById`; для строки, которой
 * нет среди загруженных страницей (другой отдел), остаётся категория из сводки и номер
 * отдела.
 */
function UnapprovedRowsList({
    rows,
    period,
    rowDetailsById,
    departmentNameById,
    onApproveRow,
    isApproving,
}: UnapprovedRowsListProps) {
    return (
        <div className="flex flex-col gap-2.5">
            <h3 className="font-ui text-sm font-bold text-ink">
                Неутверждённые строки плана · {formatPeriodLabel(period)}
            </h3>
            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                {rows.map((row) => {
                    const details = rowDetailsById[row.id]
                    const name = details?.name ?? row.category ?? 'Без категории'
                    const departmentName = departmentNameById[row.department] ?? `Отдел ${row.department}`

                    return (
                        <li key={row.id} className="flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <CircleAlert className="size-3.5 shrink-0 text-warn sm:size-4" />
                                    <span className="min-w-0 truncate font-ui text-[13px] font-semibold text-ink">
                                        {name}
                                    </span>
                                    <span className="hidden shrink-0 font-ui text-[12px] text-ink-muted sm:inline">
                                        · {departmentName}
                                    </span>
                                </div>
                                {details !== undefined && (
                                    <span className="mt-0.5 block truncate font-ui text-[11px] text-ink-muted sm:hidden">
                                        {formatCurrency(details.amount)} · {departmentName}
                                    </span>
                                )}
                            </div>
                            {details !== undefined && (
                                <span className="hidden shrink-0 font-ui text-[13px] font-semibold text-ink tabular-nums sm:inline">
                                    {formatCurrency(details.amount)}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => onApproveRow(row.id)}
                                disabled={isApproving}
                                className="shrink-0 font-ui text-[13px] font-semibold text-info-ink transition-opacity outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-50"
                            >
                                Утвердить
                            </button>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

export { UnapprovedRowsList }
