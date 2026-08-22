import { FileEdit, Hourglass, Users, Wallet } from 'lucide-react'

import { formatCurrency } from '@/shared/lib/format.ts'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'

import type { AccrualsSummary } from '../model/accrualView.ts'

/**
 * Pencil `cfNlL` (KPI Row): «Фонд оплаты» / «Сотрудников» (из них уволены: N) /
 * «Черновик» (на X ₽) / «Ожидает выплаты» (на X ₽). На мобильном (`Q0i6z3`) те же
 * карточки сеткой 2×2 — как `KpiGridMobile` плана продаж.
 */
export type AccrualsKpiRowProps = {
    summary: AccrualsSummary
    /** «июль 2026 · Сервис» — подпись первой карточки, собирается страницей. */
    periodDirectionLabel: string
    className?: string
}

function AccrualsKpiRow({ summary, periodDirectionLabel, className }: AccrualsKpiRowProps) {
    return (
        <div data-slot="accruals-kpi-row" className={className}>
            <div className="grid grid-cols-2 gap-2.5 md:flex md:flex-row md:gap-4">
                <KpiCard
                    label="Фонд оплаты"
                    value={formatCurrency(summary.totalAmount)}
                    note={periodDirectionLabel}
                    icon={<Wallet />}
                />
                <KpiCard
                    label="Сотрудников"
                    value={String(summary.employeesCount)}
                    note={summary.dismissedCount > 0 ? `из них уволены: ${summary.dismissedCount}` : 'уволенных нет'}
                    icon={<Users />}
                />
                <KpiCard
                    label="Черновик"
                    value={String(summary.draftCount)}
                    note={`на ${formatCurrency(summary.draftAmount)}`}
                    icon={<FileEdit />}
                />
                <KpiCard
                    label="Ожидает выплаты"
                    value={String(summary.awaitingCount)}
                    note={`на ${formatCurrency(summary.awaitingAmount)}`}
                    icon={<Hourglass />}
                    tone={summary.awaitingCount > 0 ? 'positive' : 'default'}
                />
            </div>
        </div>
    )
}

export { AccrualsKpiRow }
