/** Строка часов с шагом 0,5: целые — без дробной части (`8`), дробные — с одним знаком через
 * запятую (`7,5`), как того требует PRD («итоги … должны совпадать до одного знака после
 * запятой»). Своя копия `formatHours` из `pages/WorkSchedule/model/cellPresentation.ts` — та же
 * причина дублирования, что и у остальных `model/*` этой страницы (см. `model/today.ts`). */
export function formatHours(hours: number): string {
    return hours % 1 === 0 ? String(hours) : hours.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}
