import { Ellipsis } from 'lucide-react'
import type { EmployeeIdentityResponse, ExternalSystem } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

import type { EmployeeIdentityRow } from '../model/useEmployeeIdentities.ts'
import { COLUMN_WIDTH } from './identityTableColumns.ts'
import { IdentitySystemCell } from './IdentitySystemCell.tsx'

export type IdentityTableRowProps = {
    row: EmployeeIdentityRow
    onAddIdentity: (bitrixEmployeeId: number, system: ExternalSystem) => void
    onAddForEmployee: (bitrixEmployeeId: number) => void
    onEditIdentity: (identity: EmployeeIdentityResponse) => void
}

/**
 * Pencil: design/sallary-first-iteration.pen, фрейм `CpVvw` — строка таблицы 72px: аватар с
 * инициалами + имя/отдел, затем по ячейке `IdentitySystemCell` на каждую внешнюю систему и
 * прижатое вправо действие строки.
 *
 * Кнопка `Ellipsis` в макете — меню действий строки, но единственное действие уровня строки
 * (не конкретной связи) здесь одно: добавить сотруднику ещё одну связь. Правка и удаление
 * привязаны к конкретному чипу и открываются кликом по нему. Поэтому кнопка выполняет это
 * действие напрямую — заводить дропдаун-меню ради одного пункта (и новый примитив в UI Kit,
 * которого там нет) не за что.
 */
function IdentityTableRow({ row, onAddIdentity, onAddForEmployee, onEditIdentity }: IdentityTableRowProps) {
    const { employee, departmentName, initials, identitiesBySystem } = row

    return (
        <div
            data-slot="identity-table-row"
            className="flex min-h-[72px] items-center border-b border-hairline bg-surface last:border-b-0"
        >
            <div className={cn('flex shrink-0 items-center gap-[11px] px-3.5', COLUMN_WIDTH.employee)}>
                <Avatar>
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                    <span className="truncate font-ui text-sm font-medium text-ink">{employee.name}</span>
                    <span className="truncate font-ui text-xs text-ink-muted">{departmentName}</span>
                </div>
            </div>

            <IdentitySystemCell
                system="ROAPP"
                employeeName={employee.name}
                identities={identitiesBySystem.ROAPP}
                onAdd={() => onAddIdentity(employee.id, 'ROAPP')}
                onEdit={onEditIdentity}
                className={cn('shrink-0 px-3.5', COLUMN_WIDTH.roapp)}
            />

            <IdentitySystemCell
                system="MOY_SKLAD"
                employeeName={employee.name}
                identities={identitiesBySystem.MOY_SKLAD}
                onAdd={() => onAddIdentity(employee.id, 'MOY_SKLAD')}
                onEdit={onEditIdentity}
                className={cn('shrink-0 px-3.5', COLUMN_WIDTH.moySklad)}
            />

            <div className={cn('flex items-center justify-end px-3.5', COLUMN_WIDTH.actions)}>
                <IconButton
                    onClick={() => onAddForEmployee(employee.id)}
                    title="Добавить связь"
                    aria-label={`Добавить связь сотруднику ${employee.name}`}
                >
                    <Ellipsis />
                </IconButton>
            </div>
        </div>
    )
}

export { IdentityTableRow }
