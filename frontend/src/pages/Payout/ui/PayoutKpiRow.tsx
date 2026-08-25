import { Banknote, TriangleAlert, UserRoundX, Wallet } from 'lucide-react'

import { formatCurrency } from '@/shared/lib/format.ts'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'

export type PayoutKpi = {
    outstanding: number
    paidThisMonth: number
    notPaidCount: number
    negativeCount: number
}

export type PayoutKpiRowProps = {
    kpi: PayoutKpi
    className?: string
}

/** Pencil `OKluo` (KPI Row, P3.1): «Остаток к выплате» / «Выплачено за месяц» / «Сотрудников
 * не выплачено» / «С отрицательным остатком» (danger-тон, только если счётчик > 0). */
function PayoutKpiRow({ kpi, className }: PayoutKpiRowProps) {
    return (
        <div data-slot="payout-kpi-row" className={className}>
            <div className="grid grid-cols-2 gap-2.5 md:flex md:flex-row md:gap-4">
                <KpiCard label="Остаток к выплате" value={formatCurrency(kpi.outstanding)} note="сумма положительных остатков" icon={<Wallet />} />
                <KpiCard label="Выплачено за месяц" value={formatCurrency(kpi.paidThisMonth)} note="движения PAYOUT за период" icon={<Banknote />} />
                <KpiCard label="Сотрудников не выплачено" value={String(kpi.notPaidCount)} note="статус не PAID" icon={<UserRoundX />} />
                <KpiCard
                    label="С отрицательным остатком"
                    value={String(kpi.negativeCount)}
                    note={kpi.negativeCount > 0 ? 'требуют подтверждения' : 'таких нет'}
                    icon={<TriangleAlert />}
                    tone={kpi.negativeCount > 0 ? 'danger' : 'default'}
                />
            </div>
        </div>
    )
}

export { PayoutKpiRow }
