import { useState } from 'react'
import type { TargetRole, WorkScheduleDayCell, WorkScheduleStatus } from 'ireports-contracts'

import { useSaveWorkScheduleEntry } from '@/pages/WorkSchedule/model/useSaveWorkScheduleEntry.ts'
import {
    buildUpsertPayload,
    clampHours,
    DEFAULT_SHIFT_HOURS,
    resolveHoursForStatus,
} from '@/pages/WorkSchedule/model/dayEditorPayload.ts'

type UseDayEditorArgs = {
    employeeId: number
    date: string
    cell: WorkScheduleDayCell
}

/**
 * Локальное состояние + сохранение одной ячейки поповера (Фаза 7, узел `Cko6w` → `Day Editor`).
 * У узла нет кнопок «Сохранить»/«Отмена» (см. чтение design-Cko6w-calendar.html) — выбор статуса
 * сохраняется сразу по клику на пилюлю, а часы — по клику степпера или отпусканию слайдера
 * (`commitHours`, не на каждый промежуточный пиксель драга, см. `Slider.tsx`'s `onValueCommit`).
 *
 * `status`/`hours` — локальный «эхо»-стейт поверх `cell` из пропа: обновляется сразу по клику для
 * отзывчивого UI, не дожидаясь ответа сервера, и откатывается назад при ошибке мутации (см.
 * `save`). Инициализируется только один раз при монтировании (`useState` с инициализатором) —
 * компонент пересоздаётся при каждом открытии поповера (Radix не рендерит `PopoverContent`, пока
 * он закрыт), так что повторное открытие уже подхватывает свежие `cell` из ответа сервера после
 * инвалидации.
 *
 * `role` этим поповером не редактируется (вкладка «Роли» — Фаза 8, вне скоупа), но сохраняется
 * при каждой правке как есть — см. комментарий `buildUpsertPayload`.
 */
export function useDayEditor({ employeeId, date, cell }: UseDayEditorArgs) {
    const [status, setStatus] = useState<WorkScheduleStatus | null>(cell.status)
    const [hours, setHours] = useState<number>(cell.hours ?? DEFAULT_SHIFT_HOURS)
    const role: TargetRole | null = cell.role

    const mutation = useSaveWorkScheduleEntry()

    function save(
        nextStatus: WorkScheduleStatus,
        nextHours: number | null,
        previous: { status: WorkScheduleStatus | null; hours: number },
    ) {
        mutation.mutate(
            buildUpsertPayload(employeeId, date, nextStatus, nextHours, nextStatus === 'WORKING' ? role : null),
            {
                onError: () => {
                    // Тост уже показал useSaveWorkScheduleEntry — здесь только откат локального эха,
                    // чтобы пилюля/слайдер не остались зависшими в состоянии, которое не сохранилось.
                    setStatus(previous.status)
                    setHours(previous.hours)
                },
            },
        )
    }

    function selectStatus(next: WorkScheduleStatus) {
        if (next === status) return

        const previous = { status, hours }
        const nextHours = resolveHoursForStatus(next, hours)
        setStatus(next)
        if (nextHours !== null) setHours(nextHours)
        save(next, nextHours, previous)
    }

    // Степпер (+/- 0,5) и отпускание слайдера сохраняют сразу — оба уже дискретные, «закоммиченные»
    // действия пользователя, а не промежуточный кадр драга (тот идёт только в setHours, см. ниже).
    function commitHours(nextHours: number) {
        const clamped = clampHours(nextHours)
        const previous = { status, hours }
        setHours(clamped)
        if (status === 'WORKING') save('WORKING', clamped, previous)
    }

    /** Живое значение слайдера во время драга — без сети, только локальный стейт для UI. */
    function previewHours(nextHours: number) {
        setHours(clampHours(nextHours))
    }

    function stepHours(delta: number) {
        commitHours(hours + delta)
    }

    return {
        status,
        hours,
        selectStatus,
        previewHours,
        commitHours,
        stepHours,
        isSaving: mutation.isPending,
    }
}
