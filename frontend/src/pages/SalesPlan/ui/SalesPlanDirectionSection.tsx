import type { SalesDirection } from 'ireports-contracts'

import { SalesPlanCardList, SalesPlanEmptyState, SalesPlanTable, type SalesPlanRow } from '@/features/SalesPlan'

type Props = {
    direction: SalesDirection
    title: string
    rows: SalesPlanRow[]
    periodLabel: string
}

/**
 * One direction's read-only table + mobile card list inside the "Все" combined view
 * (`SalesPlanBody`) — no selection checkboxes and no Selection Bar, since "Изменить план" /
 * "Утвердить" / "Закрыть месяц" all mutate a single direction's plan and are hidden by
 * `PageHeader` whenever "Все" is selected (see its `DIRECTIONS` tabs).
 */
export function SalesPlanDirectionSection({ direction, title, rows, periodLabel }: Props) {
    return (
        <div className="flex flex-col gap-3">
            <h2 className="font-ui text-sm font-semibold text-ink">{title}</h2>
            {rows.length > 0 ? (
                <>
                    <SalesPlanTable rows={rows} className="hidden md:block" />
                    <SalesPlanCardList rows={rows} direction={direction} className="md:hidden" />
                </>
            ) : (
                <SalesPlanEmptyState periodLabel={periodLabel} />
            )}
        </div>
    )
}
