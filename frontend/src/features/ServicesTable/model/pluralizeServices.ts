/**
 * "N услуг" в подзаголовке карточки таблицы (Pencil: design/sallary-first-iteration.pen,
 * узел `h7eHG` → `tmW21` "Table Section" → заголовок блока) с корректным русским
 * склонением (1 услуга / 2–4 услуги / 5+ и 11–14 услуг) — та же модель словоизменения,
 * что и `kernel/pluralizeRules.ts`/`features/SalaryReportData/model/pluralizeEmployees.ts`,
 * просто с другим словом, поэтому не переиспользуется напрямую (слово — не параметр тех
 * функций), а короткая копия правила живёт здесь, в `features/ServicesTable`.
 */
export function pluralizeServices(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    let word: string
    if (mod10 === 1 && mod100 !== 11) word = 'услуга'
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'услуги'
    else word = 'услуг'
    return `${count} ${word}`
}
