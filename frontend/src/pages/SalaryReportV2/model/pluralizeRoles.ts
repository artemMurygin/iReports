/** "N ролей" counter — тот же приём русской плюрализации, что и `kernel/pluralizeRules.ts`/
 * `pages/SalaryReportV2/model/pluralizeDocuments.ts`, только свои словоформы ("роль"/"роли"/
 * "ролей") — нужен только шапке бенто-карточки «Источник · {направление}»
 * (`ui/DirectionSourceCard.tsx`, мета "N ролей · M правил").
 */
export function pluralizeRoles(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    let word: string
    if (mod10 === 1 && mod100 !== 11) word = 'роль'
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'роли'
    else word = 'ролей'
    return `${count} ${word}`
}
