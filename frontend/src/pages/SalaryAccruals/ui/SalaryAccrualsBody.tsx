import type { SalaryAccrual } from 'ireports-contracts'

import {
    AccrualCardList,
    AccrualsEmptyState,
    AccrualsLedgerCard,
    AccrualStatusFilterRow,
    AccrualsTotalCard,
    SelectionBar,
    type AccrualSelection,
    type AccrualsTotals,
    type AccrualStatusFilter,
} from '@/features/SalaryAccruals'

export type SalaryAccrualsBodyProps = {
    isClosed: boolean
    periodLabel: string
    /** «Сервис» / «Магазин» — для карточки «Итого» (`AccrualsTotalCard`'s note). */
    directionLabel: string
    /** Название выбранного отдела, `null` — «Все отделы» (та же карточка). */
    departmentName: string | null
    items: SalaryAccrual[]
    totals: AccrualsTotals
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
 * условного рендера): месяц не закрыт -> empty-state `Ed0FF`; закрыт -> Selection Bar (только
 * пока `selection.selectedCount > 0`, Фаза 9) + карточка-гроссбух `AccrualsLedgerCard`
 * (`LvW0I`'s `JKQdY`, «Итого» + таблица под общей рамкой, `md:` и выше) / карточка «Итого» +
 * статус-чипы/поиск + карточки документов (`DtPgO`, ниже `md:`).
 *
 * Редизайн убрал KPI Row (4 отдельные карточки) и Filter Row (статус-чипы + поиск) с
 * десктопа целиком — заменены картой «Итого» внутри `AccrualsLedgerCard`; на мобильном
 * статус-чипы + поиск (`AccrualStatusFilterRow`) остаются, как и в исходном макете.
 */
export function SalaryAccrualsBody({
    isClosed,
    periodLabel,
    directionLabel,
    departmentName,
    items,
    totals,
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
            {selection.selectedCount > 0 && (
                <SelectionBar
                    selectedCount={selection.selectedCount}
                    onClear={selection.clear}
                    onAccrueSelected={onAccrueSelected}
                />
            )}

            <AccrualsLedgerCard
                totals={totals}
                periodLabel={periodLabel}
                directionLabel={directionLabel}
                departmentName={departmentName}
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

            <div className="flex flex-col gap-4 md:hidden">
                <AccrualsTotalCard
                    totals={totals}
                    periodLabel={periodLabel}
                    directionLabel={directionLabel}
                    departmentName={departmentName}
                />

                <AccrualStatusFilterRow
                    value={statusFilter}
                    onChange={onStatusFilterChange}
                    counts={statusCounts}
                    search={search}
                    onSearchChange={onSearchChange}
                />

                <AccrualCardList
                    items={items}
                    departmentNameById={departmentNameById}
                    onOpenAccrual={onOpenAccrual}
                    headerLabel={`Документы · ${statusCounts.ALL}`}
                    footerNote={footerNote}
                />
            </div>
        </div>
    )
}
