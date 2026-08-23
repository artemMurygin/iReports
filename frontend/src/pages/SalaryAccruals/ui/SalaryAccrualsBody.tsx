import type { SalaryAccrual } from 'ireports-contracts'

import {
    AccrualCardList,
    AccrualsEmptyState,
    AccrualsKpiRow,
    AccrualStatusFilterRow,
    AccrualsTable,
    SelectionBar,
    type AccrualSelection,
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
    /** `useAccrualSelection` (features/SalaryAccruals/model) — общая инстанция для таблицы
     * (чекбоксы) и Selection Bar (Фаза 9). */
    selection: AccrualSelection
    onAccrueSelected: () => void
}

/**
 * Все ветвления страницы списка начислений (конвенция frontend/CLAUDE.md — медиатор без
 * условного рендера): месяц не закрыт -> empty-state `g6vEv`; закрыт -> KPI Row +
 * фильтр/поиск + Selection Bar (только пока `selection.selectedCount > 0`, Фаза 9) +
 * таблица (`cfNlL`, `md:` и выше) / карточки (`Q0i6z3`, ниже `md:`).
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
    selection,
    onAccrueSelected,
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

            {selection.selectedCount > 0 && (
                <SelectionBar
                    selectedCount={selection.selectedCount}
                    onClear={selection.clear}
                    onAccrueSelected={onAccrueSelected}
                />
            )}

            <AccrualsTable
                items={items}
                departmentNameById={departmentNameById}
                onOpenAccrual={onOpenAccrual}
                footerNote={footerNote}
                footerTotal={footerTotal}
                selectedIds={selection.selectedIds}
                onToggleRow={selection.toggleRow}
                onToggleAll={selection.toggleAll}
                isAllSelected={selection.isAllSelected}
                isIndeterminate={selection.isIndeterminate}
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
