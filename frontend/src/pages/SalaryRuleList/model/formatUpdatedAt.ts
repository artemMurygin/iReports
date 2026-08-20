// Explicit table rather than `Intl.DateTimeFormat('ru-RU', { month: 'short' })` — that locale
// formatter's exact output (trailing "." after the abbreviation, a trailing "г." after the year)
// varies across ICU/Node versions, and the mockup's style ("12 авг 2026", Pencil `L5GclS` → `Meta
// Row` → `Updated`) has neither, so a fixed table is the only way to match it reliably everywhere.
const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** "Обновлено 12 авг 2026" — schema card's meta row. */
export function formatUpdatedAt(isoDate: string): string {
    const date = new Date(isoDate)
    return `Обновлено ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}
