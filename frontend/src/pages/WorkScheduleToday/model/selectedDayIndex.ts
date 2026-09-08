import type { WeekDayMeta } from './weekDays.ts'

/**
 * Индекс дня ленты недели, чей уже загруженный (или ещё грузящийся) `useQueries`-результат нужно
 * показать после клика по карточке дня (`useWorkScheduleTodayPage` вызывает семь `getShift`
 * параллельно — по одному на каждый из `weekDays`, см. её комментарий — и здесь только выбирает,
 * какой из семи результатов сейчас «выбранный»).
 *
 * `-1` (дата не найдена в неделе) откатывается к 0 — своей защитой, а не полаганием на то, что
 * `selectedDate` всегда останется одной из семи дат недели: `todayIso`/`weekDays` вычисляются один
 * раз при монтировании (`useState`-инициализатор), поэтому переход через полночь посреди открытой
 * страницы теоретически мог бы увести `selectedDate` за пределы уже построенной недели — экран
 * в этом случае должен молча показать первый день, а не упасть на `shiftQueries[-1]`.
 */
export function resolveSelectedDayIndex(weekDays: WeekDayMeta[], selectedDate: string): number {
    const index = weekDays.findIndex((day) => day.date === selectedDate)
    return index === -1 ? 0 : index
}
