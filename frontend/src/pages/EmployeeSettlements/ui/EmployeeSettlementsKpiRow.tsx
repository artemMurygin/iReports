import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import type { BalanceSummaryTotals } from 'ireports-contracts'

import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'

import { buildSettlementsKpiCards, type SettlementsKpiCardVM } from '../model/kpiCards.ts'

export type EmployeeSettlementsKpiRowProps = {
    totals: BalanceSummaryTotals
    employeesCount: number
    className?: string
}

// Мокап красит саму цифру (не только рамку/подпись, как у остальных использований `KpiCard`)
// зелёным для «К выплате» и красным для «Долг» — иконка и значение колеруются точечно здесь
// (см. `KpiCard`'s `value: ReactNode`/`icon` doc), тон карточки (border) везде остаётся
// `default`, как на макете `IFJW2` (нет цветной рамки ни у одной из трёх карточек).
const ICON: Record<SettlementsKpiCardVM['key'], ReactNode> = {
    balance: <Wallet />,
    toPay: <ArrowUpRight className="text-ok-ink" />,
    debt: <ArrowDownRight className="text-danger" />,
}
const VALUE_CLASS: Record<SettlementsKpiCardVM['key'], string | undefined> = {
    balance: undefined,
    toPay: 'text-ok-ink',
    debt: 'text-danger',
}

/** Pencil `IFJW2` KPI Row: «Общий остаток» / «К выплате сотрудникам» / «Долг сотрудников
 * компании» — string/label derivation lives in `model/kpiCards.ts` (unit-tested there), this
 * component only maps each card to its icon/value color. */
function EmployeeSettlementsKpiRow({ totals, employeesCount, className }: EmployeeSettlementsKpiRowProps) {
    const cards = buildSettlementsKpiCards(totals, employeesCount)

    return (
        <div data-slot="employee-settlements-kpi-row" className={className}>
            <div className="grid grid-cols-1 gap-2.5 md:flex md:flex-row md:gap-4">
                {cards.map((card) => (
                    <KpiCard
                        key={card.key}
                        label={card.label}
                        value={
                            VALUE_CLASS[card.key] ? <span className={VALUE_CLASS[card.key]}>{card.value}</span> : card.value
                        }
                        note={card.note}
                        icon={ICON[card.key]}
                    />
                ))}
            </div>
        </div>
    )
}

export { EmployeeSettlementsKpiRow }
