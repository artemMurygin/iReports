/** "N схем" counter (Pencil `h4izP` → `Counter`: `"6 схем"`) — same Russian pluralization rule as
 * `kernel/pluralizeRules.ts`, different word forms, so kept as its own small function rather than
 * generalizing that one (which is `kernel`-level shared with `pages/SalaryRules`) just for this one
 * extra caller. */
export function pluralizeSchemas(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    let word: string
    if (mod10 === 1 && mod100 !== 11) word = 'схема'
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'схемы'
    else word = 'схем'
    return `${count} ${word}`
}
