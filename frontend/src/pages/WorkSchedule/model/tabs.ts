import type { SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'

// Режим отображения страницы «График работы» — переключатель `Mode Tabs` (design:
// design/sallary-first-iteration.pen, узлы `Cko6w`/`vO4tI` -> `Control Row` -> `Mode Tabs`). Это
// отдельный `useState` в `useWorkSchedulePage`, а не производное от `month`/`departmentId` —
// переключение вкладки не должно сбрасывать выбранный месяц/отдел (план, Фаза 8: "вкладки
// «Календарь» / «Роли» с сохранением выбранного месяца и отдела при переключении"): три состояния
// живут независимо, так что смена одного не может задеть остальные два.

export type WorkScheduleTab = 'CALENDAR' | 'ROLES'

/** Опции для `SegmentedControl` (см. `ControlRow.tsx`) — подписи 1:1 из дизайна («Календарь» /
 * «Роли», узел `Mode Tabs`). */
export const WORK_SCHEDULE_TAB_OPTIONS: SegmentedControlOption<WorkScheduleTab>[] = [
    { value: 'CALENDAR', label: 'Календарь' },
    { value: 'ROLES', label: 'Роли' },
]
