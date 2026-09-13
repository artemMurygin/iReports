/** "N документов" counter (`RuleSourcesRail`'s "ещё N документов") — same Russian pluralization
 * rule as `kernel/pluralizeRules.ts`/`pages/SalaryRuleList/model/pluralizeSchemas.ts`, different
 * word forms, so kept as its own small function. Replaces the previous inline
 * `hidden.length === 1 ? 'документ' : 'документов'`, which was grammatically wrong for 2-4
 * (produced "2 документов" instead of "2 документа").
 */
export function pluralizeDocuments(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    let word: string
    if (mod10 === 1 && mod100 !== 11) word = 'документ'
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'документа'
    else word = 'документов'
    return `${count} ${word}`
}
