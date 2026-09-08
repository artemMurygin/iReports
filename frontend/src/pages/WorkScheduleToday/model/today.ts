/** Сегодняшняя календарная дата `YYYY-MM-DD` по локальному времени устройства — якорь недели
 * ленты и дефолт выбранного дня. Своя копия `getTodayIso` из `pages/WorkSchedule/model/format.ts`
 * — `pages` не может импортировать другую `pages` (frontend/CLAUDE.md, границы FSD), а ради одной
 * трёхстрочной функции заводить общий kernel-модуль не стоит (тот же выбор уже сделан в
 * `pages/WorkSchedule/model/format.ts` для `workScheduleMonthSchema`, см. её комментарий). */
export function getTodayIso(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
