import { useState } from 'react'
import type { TargetRole, WorkScheduleDayCell } from 'ireports-contracts'

import { buildUpsertPayload } from '@/pages/WorkSchedule/model/dayEditorPayload.ts'
import { useSaveWorkScheduleEntry } from '@/pages/WorkSchedule/model/useSaveWorkScheduleEntry.ts'

type UseRolePickerArgs = {
    employeeId: number
    date: string
    cell: WorkScheduleDayCell
}

/**
 * Локальное состояние + сохранение роли одной ячейки вкладки «Роли» (Фаза 8b, план: «Назначение
 * роли рабочему дню из ячейки с сохранением через тот же upsert»). Тот же приём echo-стейта +
 * отката при ошибке, что и `useDayEditor.ts` (Фаза 7), но без статус-пилюль/слайдера часов — этот
 * поповер редактирует единственное поле, `role`.
 *
 * Рендерится только для рабочего дня (`RolesTableRow` пускает сюда лишь ячейки с
 * `isRoleEditableCell(cell) === true`, см. `model/rolePresentation.ts`), поэтому `cell.status`
 * здесь гарантированно `'WORKING'` — `buildUpsertPayload` вызывается с ним и с `cell.hours`/
 * `cell.isOnDuty` как есть, без изменений (план: «передавая текущие статус/часы этого дня без
 * изменений»; дежурство эта вкладка не редактирует — только роль, см. `ui/DayEditorPopover` для
 * переключателя). Тот же билдер, что и у `useDayEditor` — не две copy-paste версии сборки тела
 * `PUT /v1/work-schedule/entries`.
 */
export function useRolePicker({ employeeId, date, cell }: UseRolePickerArgs) {
    const [role, setRole] = useState<TargetRole | null>(cell.role)

    const mutation = useSaveWorkScheduleEntry()

    function selectRole(next: TargetRole) {
        if (next === role) return

        const previous = role
        setRole(next)
        mutation.mutate(buildUpsertPayload(employeeId, date, 'WORKING', cell.hours, next, cell.isOnDuty), {
            onError: () => {
                // Тост уже показал useSaveWorkScheduleEntry — здесь только откат локального эха.
                setRole(previous)
            },
        })
    }

    return { role, selectRole, isSaving: mutation.isPending }
}
