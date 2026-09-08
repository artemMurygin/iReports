import { cn } from '@/shared/lib/tw'

import { AccrualsTable, type AccrualsTableProps } from './AccrualsTable.tsx'
import { AccrualsTotalCard, type AccrualsTotalCardProps } from './AccrualsTotalCard.tsx'

export type AccrualsLedgerCardProps = Omit<AccrualsTotalCardProps, 'className'> &
    Omit<AccrualsTableProps, 'className'> & {
        className?: string
    }

/**
 * Pencil `LvW0I`'s `JKQdY` (`Ledger · Начисления`, десктоп) — общий контейнер, найденный в
 * редизайне списка: карточка «Итого» (`RsJQs`) сверху + таблица документов ниже, разделённые
 * `hairline`-границей, внутри одной рамки/скругления/тени. Тот же приём, что `LedgerCard`
 * (`pages/SalaryReportV2`) — `LedgerHero` + `LedgerDirectionBlock` под общей рамкой вместо
 * отдельных карточек. Десктоп-only (мобильный рендерит `AccrualsTotalCard`/`AccrualCardList`
 * раздельно, см. `SalaryAccrualsBody`), поэтому `AccrualsTable`'s собственная рамка/скругление
 * здесь снимаются — она становится внутренним содержимым общего контейнера.
 */
function AccrualsLedgerCard({
    totals,
    periodLabel,
    directionLabel,
    departmentName,
    items,
    departmentNameById,
    onOpenAccrual,
    footerNote,
    footerTotal,
    selectedIds,
    onToggleRow,
    onToggleAll,
    isAllSelected,
    isIndeterminate,
    className,
}: AccrualsLedgerCardProps) {
    return (
        <div
            data-slot="accruals-ledger-card"
            className={cn(
                'overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0_2px_14px_-8px_rgba(1,3,6,0.35)]',
                className,
            )}
        >
            <AccrualsTotalCard
                totals={totals}
                periodLabel={periodLabel}
                directionLabel={directionLabel}
                departmentName={departmentName}
            />

            <div className="border-t border-hairline">
                <AccrualsTable
                    items={items}
                    departmentNameById={departmentNameById}
                    onOpenAccrual={onOpenAccrual}
                    footerNote={footerNote}
                    footerTotal={footerTotal}
                    selectedIds={selectedIds}
                    onToggleRow={onToggleRow}
                    onToggleAll={onToggleAll}
                    isAllSelected={isAllSelected}
                    isIndeterminate={isIndeterminate}
                    className="rounded-none border-0"
                />
            </div>
        </div>
    )
}

export { AccrualsLedgerCard }
