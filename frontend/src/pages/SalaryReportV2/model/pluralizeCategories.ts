/** "N категорий" — та же плюрализация, что и `kernel/pluralizeRules.ts`/`pages/SalaryReportV2/model/
 * pluralizeRoles.ts`, только свои словоформы ("категория"/"категории"/"категорий"). Нужен только
 * мета-строке шапки `SalesPlanDetailsPanel` (Pencil `BvW3A`: "Направление «Сервис» · 7 категорий ·
 * …") — `features/SalesPlan/model/format.ts`'s одноимённая функция возвращает только словоформу без
 * числа и не реэкспортирована из `@/features/SalesPlan`'s публичного API. */
export function pluralizeCategories(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    let word: string
    if (mod10 === 1 && mod100 !== 11) word = 'категория'
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'категории'
    else word = 'категорий'
    return `${count} ${word}`
}
