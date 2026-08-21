// Форматтеры месяца/даты для страницы «График работы». Дублируют небольшой, независимый набор
// утилит (не переиспользуют `features/SalesPlan/model/format.ts`) по тому же прецеденту, что уже
// описан в комментарии `PeriodPicker.tsx`/`format.ts` фичи `SalesPlan`: страница может
// импортировать из чужой фичи технически, но `formatPeriodLabel`/`shiftPeriod` там документированы
// как специфичные для плана продаж утилиты этой конкретной фичи, а не общий кернел-модуль — заводить
// перекрёстную зависимость «страница графика работы -> фича плана продаж» ради трёх функций хуже,
// чем скопировать их (тот же выбор уже сделан для `workScheduleMonthSchema` на бэкенде/контрактах).

const MONTHS_NOMINATIVE = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
]

const MONTHS_GENITIVE = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
]

/** Полные (не сокращённые, как `weekdayShort` в `scheduleDays.ts`) названия дня недели — нужны
 * только заголовку поповера редактирования дня (`Day Editor` → `Head` → `Date`, узел `Cko6w`),
 * где день недели пишется словом целиком («четверг»), а не двумя буквами, как в шапке таблицы.
 * Индекс — тот же `Date.getUTCDay()` (0 = воскресенье), что и `WEEKDAY_SHORT`. */
const WEEKDAY_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']

/** '2026-08' -> 'август 2026'. Возвращает исходную строку, если она не соответствует `YYYY-MM`. */
export function formatMonthLabel(month: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(month)
    if (!match) return month

    const [, year, monthNum] = match
    const monthName = MONTHS_NOMINATIVE[Number(monthNum) - 1]
    return monthName ? `${monthName} ${year}` : month
}

/** '2026-08-18' -> '18 августа 2026' — используется «Today Chip» в `PageHeader`. */
export function formatFullDateLabel(dateIso: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
    if (!match) return dateIso

    const [, year, monthNum, day] = match
    const monthName = MONTHS_GENITIVE[Number(monthNum) - 1]
    return monthName ? `${Number(day)} ${monthName} ${year}` : dateIso
}

/** '2026-08-20' -> '20 августа, четверг' — заголовок поповера редактирования дня (Фаза 7, узел
 * `Cko6w` → `Day Editor` → `Head` → `Date`). `Date.UTC`, тем же приёмом, что и `buildMonthDays` —
 * день недели календарной даты не должен зависеть от часового пояса браузера. */
export function formatDayEditorDateLabel(dateIso: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
    if (!match) return dateIso

    const [, yearStr, monthStr, dayStr] = match
    const monthName = MONTHS_GENITIVE[Number(monthStr) - 1]
    if (!monthName) return dateIso

    const weekday = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr))).getUTCDay()
    return `${Number(dayStr)} ${monthName}, ${WEEKDAY_FULL[weekday]}`
}

/** Зеркалит `workScheduleMonthSchema` (`contracts/commands/work-schedule.ts`) без рантайм-импорта
 * из `ireports-contracts` — та же причина, что и у `isValidPeriod` в `features/SalesPlan`. */
export function isValidMonth(month: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
}

/** '2026-08' + 1 -> '2026-09', '2026-01' + (-1) -> '2025-12'. `Date.UTC` переносит год сам —
 * без ручной обработки границы декабрь/январь. */
export function shiftMonth(month: string, deltaMonths: number): string {
    const match = /^(\d{4})-(\d{2})$/.exec(month)
    if (!match) return month

    const [, year, monthNum] = match
    const shifted = new Date(Date.UTC(Number(year), Number(monthNum) - 1 + deltaMonths, 1))
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Текущий месяц в формате `YYYY-MM` по локальному времени устройства — дефолт `month` на
 * странице (пользователь открывает график и сразу видит текущий месяц). */
export function getCurrentMonthIso(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Сегодняшняя календарная дата в формате `YYYY-MM-DD` по локальному времени устройства —
 * используется и для «Today Chip», и для подсветки сегодняшнего дня в шапке таблицы. */
export function getTodayIso(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
