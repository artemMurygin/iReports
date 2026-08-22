import type { SalaryAccrual } from 'ireports-contracts'

import {
    AccrualCardList,
    AccrualsEmptyState,
    AccrualsKpiRow,
    AccrualStatusFilterRow,
    AccrualsTable,
    type AccrualStatusFilter,
    type AccrualsSummary,
} from '@/features/SalaryAccruals'

export type SalaryAccrualsBodyProps = {
    isClosed: boolean
    periodLabel: string
    periodDirectionLabel: string
    items: SalaryAccrual[]
    summary: AccrualsSummary
    statusCounts: Record<AccrualStatusFilter, number>
    statusFilter: AccrualStatusFilter
    onStatusFilterChange: (filter: AccrualStatusFilter) => void
    search: string
    onSearchChange: (search: string) => void
    departmentNameById: Record<number, string>
    footerNote: string
    footerTotal: string
    onOpenAccrual: (id: string) => void
    onGoToSalesPlan: () => void
}

/**
 * Все ветвления страницы списка начислений (конвенция frontend/CLAUDE.md — медиатор без
 * условного рендера): месяц не закрыт -> empty-state `g6vEv`; закрыт -> KPI Row +
 * фильтр/поиск + таблица (`cfNlL`, `md:` и выше) / карточки (`Q0i6z3`, ниже `md:`).
 */
export function SalaryAccrualsBody({
    isClosed,
    periodLabel,
    periodDirectionLabel,
    items,
    summary,
    statusCounts,
    statusFilter,
    onStatusFilterChange,
    search,
    onSearchChange,
    departmentNameById,
    footerNote,
    footerTotal,
    onOpenAccrual,
    onGoToSalesPlan,
}: SalaryAccrualsBodyProps) {
    if (!isClosed) {
        return <AccrualsEmptyState periodLabel={periodLabel} onGoToSalesPlan={onGoToSalesPlan} />
    }

    return (
        <div className="flex flex-col gap-4">
            <AccrualsKpiRow summary={summary} periodDirectionLabel={periodDirectionLabel} />

            <AccrualStatusFilterRow
                value={statusFilter}
                onChange={onStatusFilterChange}
                counts={statusCounts}
                search={search}
                onSearchChange={onSearchChange}
            />

            <AccrualsTable
                items={items}
                departmentNameById={departmentNameById}
                onOpenAccrual={onOpenAccrual}
                footerNote={footerNote}
                footerTotal={footerTotal}
                className="hidden md:block"
            />
            <AccrualCardList
                items={items}
                departmentNameById={departmentNameById}
                onOpenAccrual={onOpenAccrual}
                headerLabel={`Документы · ${statusCounts.ALL}`}
                footerNote={footerNote}
                className="md:hidden"
            />
        </div>
    )
}
