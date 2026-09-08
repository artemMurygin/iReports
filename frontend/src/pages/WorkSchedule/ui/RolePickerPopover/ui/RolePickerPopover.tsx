import type { WorkScheduleDayCell } from 'ireports-contracts'

import { useRolePicker } from '../model/useRolePicker.ts'
import { RoleOptions } from './RoleOptions.tsx'

export type RolePickerPopoverProps = {
    employeeId: number
    employeeName: string
    date: string
    dateLabel: string
    cell: WorkScheduleDayCell
}

/**
 * Содержимое поповера выбора роли — вкладка «Роли» (Фаза 8b, узел `vO4tI`), открывается кликом по
 * ячейке рабочего дня (`RolesTable.tsx`, только когда `isRoleEditableCell(cell)`, см.
 * `model/rolePresentation.ts`). Тот же заголовок «дата + сотрудник», что и `DayEditorPopover.tsx`
 * (Фаза 7, узел `Cko6w` → `Day Editor` → `Head`) — `dateLabel` приходит уже отформатированным
 * (`formatDayEditorDateLabel`, вызванный в `RolesTable.tsx`, тем же приёмом, что и в
 * `ScheduleTableRow`), второй источник этого же формата не заводим. Ни статус, ни часы здесь не
 * редактируются (план: «передавая текущие статус/часы этого дня без изменений») — только `RoleOptions`.
 */
function RolePickerPopover({ employeeId, employeeName, date, dateLabel, cell }: RolePickerPopoverProps) {
    const { role, selectRole } = useRolePicker({ employeeId, date, cell })

    return (
        <div data-slot="role-picker" className="flex w-full flex-col gap-3">
            <div data-slot="role-picker-head" className="flex w-full flex-col gap-0.5">
                <span className="font-ui text-[13px] font-semibold text-ink">{dateLabel}</span>
                <span className="font-ui text-[11px] font-normal text-ink-faint">{employeeName}</span>
            </div>

            <RoleOptions role={role} onSelect={selectRole} />
        </div>
    )
}

export { RolePickerPopover }
