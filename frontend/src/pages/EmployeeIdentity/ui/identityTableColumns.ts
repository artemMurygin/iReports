/**
 * Ширины колонок таблицы 1:1 с макетом (Pencil: design/sallary-first-iteration.pen, фрейм
 * `CpVvw`): Сотрудник 320 / RemOnline 410 / МойСклад 410, действия забирают остаток.
 *
 * Вынесены в отдельный модуль, потому что шапка (`IdentityTable`) и строка
 * (`IdentityTableRow`) — разные файлы, а колонки у div-«таблицы» держатся только на том, что
 * ширины в них совпадают: расхождение на пиксель сразу разъезжается визуально.
 */
export const COLUMN_WIDTH = {
    employee: 'w-[320px]',
    roapp: 'w-[410px]',
    moySklad: 'w-[410px]',
    actions: 'min-w-[72px] flex-1',
} as const

/** Сумма фиксированных колонок + минимум под действия — ниже включается горизонтальный скролл. */
export const TABLE_MIN_WIDTH = 'min-w-[1212px]'
