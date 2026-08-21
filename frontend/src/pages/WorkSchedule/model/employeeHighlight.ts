/**
 * Разбирает `?employeeId=` из URL — с этим параметром сюда переходит тап по сотруднику с
 * мобильного экрана «Отдел сегодня» (`pages/WorkScheduleToday/model/employeeScheduleLink.ts`,
 * план, Фаза 9: «Переход с карточки сотрудника на его график»). Строгая проверка целого
 * положительного числа, а не голый `Number(...)`, — мусор в URL (не число, `NaN`, отрицательное,
 * дробное) не должен подсвечивать случайную строку таблицы.
 */
export function parseHighlightedEmployeeId(raw: string | null): number | null {
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}
