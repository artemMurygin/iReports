import { useState } from 'react'
import type { TargetRole, WorkScheduleDayCell } from 'ireports-contracts'

import { useSaveWorkScheduleEntry } from '@/pages/WorkSchedule/model/useSaveWorkScheduleEntry.ts'
import { buildUpsertPayload } from '@/pages/WorkSchedule/model/dayEditorPayload.ts'

type UseRoleEditorArgs = {
    employeeId: number
    date: string
    cell: WorkScheduleDayCell
}

/**
 * Локальное состояние + сохранение роли одной ячейки вкладки «Роли» (Фаза 8, узел `vO4tI`) —
 * аналог `DayEditorPopover`'s `useDayEditor.ts`, но правит только `role`; `status`/`hours` дня уже
 * заданы (эта ячейка кликабельна только для `status = WORKING`, см. `isRoleCellEditable` в
 * `rolePresentation.ts`) и передаются в `buildUpsertPayload` как есть — `WorkScheduleEntry.edit()`
 * на бэкенде заменяет состояние дня целиком (см. комментарий `buildUpsertPayload`), поэтому не
 * передать уже заданные часы здесь значило бы молча стереть их при простом назначении роли.
 *
 * Как и `useDayEditor`, сохраняет сразу по клику на пилюль без кнопки «Сохранить» (в узле `vO4tI`
 * нет footer-кнопок ни у одного элемента управления), с локальным «эхо»-стейтом, откатывающимся при
 * ошибке мутации.
 */
export function useRoleEditor({ employeeId, date, cell }: UseRoleEditorArgs) {
    const [role, setRole] = useState<TargetRole | null>(cell.role)
    const mutation = useSaveWorkScheduleEntry()

    function selectRole(next: TargetRole) {
        if (next === role) return

        const previous = role
        setRole(next)
        mutation.mutate(buildUpsertPayload(employeeId, date, 'WORKING', cell.hours, next), {
            onError: () => {
                setRole(previous)
            },
        })
    }

    return { role, selectRole, isSaving: mutation.isPending }
}
