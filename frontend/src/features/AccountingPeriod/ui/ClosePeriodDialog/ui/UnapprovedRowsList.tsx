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
 * Перечень неутверждённых строк плана со ссылкой «Утвердить» у каждой
 * (Pencil `KPPJ5`: заголовок «Неутверждённые строки плана · июль 2026», строки
 * «Ремонт Apple · Отдел сервиса … 1 450 000 ₽ [Утвердить]»). Название/сумма берутся
 * из `rowDetailsById`; для строки, которой нет среди загруженных страницей (другой
 * отдел), остаётся категория из сводки и номер отдела.
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
                        <li key={row.id} className="flex items-center gap-2.5 px-4 py-3">
                            <CircleAlert className="size-4 shrink-0 text-warn" />
                            <span className="min-w-0 flex-1 truncate font-ui text-[13px]">
                                <span className="font-semibold text-ink">{name}</span>
                                <span className="text-ink-muted"> · {departmentName}</span>
                            </span>
                            {details !== undefined && (
                                <span className="shrink-0 font-ui text-[13px] font-semibold text-ink tabular-nums">
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
