import type { WorkScheduleDayAggregate, WorkScheduleDayCell, WorkScheduleEmployeeRow } from 'ireports-contracts'

// Бэкенд уже гарантирует «одна ячейка на каждый календарный день месяца» и «один агрегат на
// каждый день» в хронологическом порядке (см. `GET /v1/work-schedule` в ENDPOINTS.md), но строить
// доступ к ячейке/агрегату строго по индексу массива — хрупко: сортировка по дате гарантирована
// контрактом, а не типом. Оба хелпера строят `Map<date, …>` один раз на строку/ответ, чтобы
// `ScheduleTableRow`/`ScheduleTableFooterRow` доставали значение по конкретной дате из
// `buildMonthDays`, а не полагались на совпадение позиций.

/** `employee.days` -> `Map<date, cell>` для одного сотрудника. */
export function buildEmployeeCellMap(row: Pick<WorkScheduleEmployeeRow, 'days'>): Map<string, WorkScheduleDayCell> {
    return new Map(row.days.map((cell) => [cell.date, cell]))
}

/** `response.days` (агрегаты «человек в смене» по дню) -> `Map<date, peopleOnShift>`. */
export function buildDayAggregateMap(days: WorkScheduleDayAggregate[]): Map<string, number> {
    return new Map(days.map((entry) => [entry.date, entry.peopleOnShift]))
}

/** Остаток дней отпуска на год — `vacationDaysLimit - vacationDaysUsed`, не меньше нуля (лимит
 * не может быть превышен по бизнес-правилу, но защищаемся от отрицательного значения в UI на
 * случай рассинхронизации данных). */
export function vacationDaysRemaining(row: Pick<WorkScheduleEmployeeRow, 'vacationDaysUsed' | 'vacationDaysLimit'>): number {
    return Math.max(0, row.vacationDaysLimit - row.vacationDaysUsed)
}

/** Порог «мало дней отпуска осталось» — в дизайне (Cko6w, строка «Артём Мурыгин») остаток
 * красится в `warn-ink` только у единственного сотрудника с остатком 9 (у всех остальных — от 13
 * и выше, и они цвета `ink`). Однозначного порога дизайн не называет — 10 выбрано как ближайшее
 * круглое число строго между наблюдаемыми 9 (warn) и 13 (ink), т.е. «меньше двузначного запаса». */
const LOW_VACATION_THRESHOLD = 10

export function isVacationLow(remaining: number): boolean {
    return remaining < LOW_VACATION_THRESHOLD
}
