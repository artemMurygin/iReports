import type { EmployeeIdentityResponse, ExternalSystem } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { employeesPlural } from '../model/identityLabels.ts'
import type { EmployeeIdentityRow } from '../model/useEmployeeIdentities.ts'
import { IdentityCard } from './IdentityCard.tsx'

export type IdentityCardListProps = {
    rows: EmployeeIdentityRow[]
    totalCount: number
    onAddIdentity: (bitrixEmployeeId: number, system: ExternalSystem) => void
    onAddForEmployee: (bitrixEmployeeId: number) => void
    onEditIdentity: (identity: EmployeeIdentityResponse) => void
    className?: string
}

/**
 * Мобильный эквивалент `IdentityTable` (Pencil: фрейм `Tu1Fs`): список карточек плюс тот же
 * подвал-счётчик, что и у таблицы, только строкой под списком.
 *
 * Выбран именно перенос в карточки, а не горизонтальный скролл таблицы: во-первых, так решено
 * в макете, во-вторых, это уже принятый на соседних страницах приём — `pages/SalesPlan`
 * рендерит `SalesPlanTable` под `hidden md:block` и `SalesPlanCardList` под `md:hidden`.
 * Горизонтальный скролл в таблице всё равно остаётся, но как запасной вариант для узкого
 * десктопа, а не как мобильный режим.
 */
function IdentityCardList({
    rows,
    totalCount,
    onAddIdentity,
    onAddForEmployee,
    onEditIdentity,
    className,
}: IdentityCardListProps) {
    return (
        <div data-slot="identity-card-list" className={cn('flex flex-col gap-2.5', className)}>
            {rows.map((row) => (
                <IdentityCard
                    key={row.employee.id}
                    row={row}
                    onAddIdentity={onAddIdentity}
                    onAddForEmployee={onAddForEmployee}
                    onEditIdentity={onEditIdentity}
                />
            ))}

            <div className="flex flex-col gap-1 px-1 py-1">
                <span className="font-ui text-xs text-ink-muted">
                    Показаны {rows.length} из {totalCount} {employeesPlural(totalCount)}
                </span>
                <span className="font-ui text-xs text-ink-muted">
                    Новая связь учитывается со следующего расчёта зарплаты
                </span>
            </div>
        </div>
    )
}

export { IdentityCardList }
