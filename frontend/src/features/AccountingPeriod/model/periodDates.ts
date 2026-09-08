/**
 * «Истёкший месяц» — закрывать можно только календарный месяц, который уже закончился.
 * Бэкенд считает границы периода в UTC (Period.getBounds(): первое число 00:00 UTC —
 * см. заметку Фазы 2 docs/payroll-closing-and-accrual), поэтому и фронтовый дизейбл
 * кнопки «Закрыть месяц» считается в UTC, а не в локальном времени браузера — иначе
 * в ночь на первое число (00:00–03:00 МСК) кнопка была бы активна, а бэкенд отвечал
 * бы `409 PeriodNotExpired`.
 */
export function isPeriodExpired(period: string, now: Date = new Date()): boolean {
    const match = /^(\d{4})-(\d{2})$/.exec(period)
    if (!match) return false

    const [, year, month] = match
    // Первое число СЛЕДУЮЩЕГО месяца, 00:00 UTC — момент, с которого месяц истёк
    // (ролловер месяца 12 -> следующий год делает Date.UTC сам).
    const expiresAt = Date.UTC(Number(year), Number(month), 1)
    return now.getTime() >= expiresAt
}
