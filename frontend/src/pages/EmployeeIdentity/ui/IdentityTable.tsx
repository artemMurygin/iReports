import type { EmployeeIdentityResponse, ExternalSystem } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'

import { employeesPlural } from '../model/identityLabels.ts'
import type { EmployeeIdentityRow } from '../model/useEmployeeIdentities.ts'
import { COLUMN_WIDTH, TABLE_MIN_WIDTH } from './identityTableColumns.ts'
import { IdentityTableRow } from './IdentityTableRow.tsx'

export type IdentityTableProps = {
    rows: EmployeeIdentityRow[]
    /** Всего сотрудников в справочнике — знаменатель подписи «Показаны N из M». */
    totalCount: number
    onAddIdentity: (bitrixEmployeeId: number, system: ExternalSystem) => void
    onAddForEmployee: (bitrixEmployeeId: number) => void
    onEditIdentity: (identity: EmployeeIdentityResponse) => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, фрейм `CpVvw` — таблица связей: шапка 40px на
 * `canvas`, строки по 72px и подвал 44px со счётчиком и напоминанием про расчёт зарплаты.
 *
 * Свёрстана флексовыми div'ами, а не `<table>`: это канон проекта для нового UI Kit (см.
 * `features/SalesPlan/ui/SalesPlanTable.tsx`) — семантическая таблица из `shared/ui` живёт на
 * старых токенах и в новый дизайн не встраивается. Отсюда же приём с горизонтальным скроллом:
 * контейнер `overflow-x-auto` поверх фиксированной минимальной ширины, чтобы колонки не
 * сжимались. На узких экранах эта таблица не показывается вовсе — там рендерится
 * `IdentityCardList` (макет `Tu1Fs`).
 */
function IdentityTable({
    rows,
    totalCount,
    onAddIdentity,
    onAddForEmployee,
    onEditIdentity,
    className,
}: IdentityTableProps) {
    return (
        <div
            data-slot="identity-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div className={TABLE_MIN_WIDTH}>
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        <ColumnHeader label="Сотрудник" emphasis className={cn('px-3.5', COLUMN_WIDTH.employee)} />
                        <ColumnHeader label="RemOnline" emphasis className={cn('px-3.5', COLUMN_WIDTH.roapp)} />
                        <ColumnHeader label="МойСклад" emphasis className={cn('px-3.5', COLUMN_WIDTH.moySklad)} />
                        <ColumnHeader label="" className={cn('px-3.5', COLUMN_WIDTH.actions)} />
                    </div>

                    {rows.map((row) => (
                        <IdentityTableRow
                            key={row.employee.id}
                            row={row}
                            onAddIdentity={onAddIdentity}
                            onAddForEmployee={onAddForEmployee}
                            onEditIdentity={onEditIdentity}
                        />
                    ))}
                </div>
            </div>

            <div className="flex h-11 flex-wrap items-center justify-between gap-2 border-t border-hairline bg-canvas px-3.5">
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

export { IdentityTable }
