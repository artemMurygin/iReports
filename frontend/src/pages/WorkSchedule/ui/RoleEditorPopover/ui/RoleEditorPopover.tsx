import type { WorkScheduleDayCell } from 'ireports-contracts'

import { useRoleEditor } from '../model/useRoleEditor.ts'
import { RoleOptions } from './RoleOptions.tsx'

export type RoleEditorPopoverProps = {
    employeeId: number
    employeeName: string
    date: string
    dateLabel: string
    cell: WorkScheduleDayCell
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `vO4tI` — содержимое поповера назначения роли,
 * открываемого кликом по рабочей ячейке таблицы вкладки «Роли» (`RolesTable.tsx`). Сам узел не
 * показывает попап как отдельный оверлей (в отличие от `Cko6w`'s `Day Editor` — см. чтение
 * design-vO4tI-roles.html, файл заканчивается на `Footer Row`), поэтому содержимое воспроизводит
 * `Head`-слот `DayEditorPopover` (дата + имя сотрудника) вокруг `RoleOptions` — тот же способ
 * идентифицировать ячейку, что и в календаре, без придумывания нового.
 *
 * Статус/часы дня здесь не редактируются (это `Cko6w`, Фаза 7) — попап открывается только для
 * рабочих дней (`isRoleCellEditable`, `RolesTable.tsx`), так что во всех случаях день уже `WORKING`.
 */
function RoleEditorPopover({ employeeId, employeeName, date, dateLabel, cell }: RoleEditorPopoverProps) {
    const { role, selectRole } = useRoleEditor({ employeeId, date, cell })

    return (
        <div data-slot="role-editor" className="flex w-full flex-col gap-3">
            <div data-slot="role-editor-head" className="flex w-full flex-col gap-0.5">
                <span className="font-ui text-[13px] font-semibold text-ink">{dateLabel}</span>
                <span className="font-ui text-[11px] font-normal text-ink-faint">{employeeName}</span>
            </div>

            <RoleOptions role={role} onSelect={selectRole} />
        </div>
    )
}

export { RoleEditorPopover }
