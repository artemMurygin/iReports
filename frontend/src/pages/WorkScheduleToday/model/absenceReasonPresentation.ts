import type { WorkScheduleAbsenceReason } from 'ireports-contracts'

// Стиль бейджа причины отсутствия блока «Не на смене» (узел `A5SbT` -> `Section Не на смене` ->
// `Absence Card` -> `Row *` -> `Badge`) — та же палитра статусов дня, что и `STATUS_STYLE` в
// `pages/WorkSchedule/model/cellPresentation.ts` (узел `Cko6w`, легенда «Работает/Выходной/
// Отгул/Больничный/Отпуск»): свотчи двух узлов дизайна совпадают 1:1 по hex (см. чтение
// design-A5SbT-mobile.html и design-Cko6w-calendar.html), но своя копия — `pages` не может
// импортировать `pages` (frontend/CLAUDE.md), тот же выбор, что и у `model/rolePresentation.ts`
// этой же страницы (см. её комментарий).
//
// Одно расхождение с `STATUS_STYLE`: `DAY_OFF` здесь красится в `text-ink-muted`
// (`#939393`, дизайн), а не в `text-ink-faint` (`#c4c4c4`, `cellPresentation.ts`) — цвет подписи
// именно этого бейджа в `A5SbT` светлее, чем глиф той же причины в ячейке `Cko6w` (визуально
// сверено по обоим экспортам, это не опечатка макета).

export type AbsenceReasonStyle = {
    label: string
    bgClassName: string
    textClassName: string
}

const ABSENCE_REASON_STYLE: Record<WorkScheduleAbsenceReason, AbsenceReasonStyle> = {
    DAY_OFF: { label: 'Выходной', bgClassName: 'bg-canvas', textClassName: 'text-ink-muted' },
    TIME_OFF: { label: 'Отгул', bgClassName: 'bg-warn-soft', textClassName: 'text-warn-ink' },
    SICK_LEAVE: { label: 'Больничный', bgClassName: 'bg-danger-soft', textClassName: 'text-danger' },
    VACATION: { label: 'Отпуск', bgClassName: 'bg-info-soft', textClassName: 'text-info-ink' },
    // Дизайн не показывает эту причину (макет наполнен четырьмя причинами из пяти) — сотрудник
    // без записи графика на дату (ENDPOINTS.md, Фаза 4: "Сотрудники без записи ... попадают в
    // «не на смене» с отдельной причиной «не заполнен»"). Тот же нейтральный `canvas`, что и у
    // `DAY_OFF` (оба — «формально пусто», не особая причина вроде отпуска/болезни), но более
    // блёклый текст (`ink-faint`, тот же токен, что и у `EMPTY`-ячейки в `cellPresentation.ts`),
    // чтобы отличаться от бейджа «Выходной» на глаз.
    NOT_FILLED: { label: 'Не заполнен', bgClassName: 'bg-canvas', textClassName: 'text-ink-faint' },
}

/** Порядок совпадает с фиксированным порядком групп в ответе `GET /v1/work-schedule/shift`
 * (`ABSENCE_REASON_ORDER` бэкенда, `get-work-schedule-shift.service.ts`) — фронту не нужно
 * пересортировывать группы, только раскрасить каждую по её `reason`. */
export function resolveAbsenceReasonStyle(reason: WorkScheduleAbsenceReason): AbsenceReasonStyle {
    return ABSENCE_REASON_STYLE[reason]
}
