/**
 * Moved here from `pages/SalaryRules/model/ruleSummary.ts` — a pure formatting function needed by
 * both `pages/SalaryRules` (rule-count footer on Step 1's target card) and `pages/SalaryRuleList`
 * (schema card's "N правил" meta text), so it belongs in `kernel` rather than a page (see
 * frontend/CLAUDE.md's layer table). `pages/SalaryRules/model/ruleSummary.ts` re-exports it under
 * its original name so its existing consumer keeps working unchanged.
 *
 * "N правил" counter badge (Pencil `tSYIw` → `Counter`: `"3 правила"`) with correct Russian
 * pluralization (1 правило / 2–4 правила / 5+ и 11–14 правил).
 */
export function pluralizeRules(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    let word: string
    if (mod10 === 1 && mod100 !== 11) word = 'правило'
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'правила'
    else word = 'правил'
    return `${count} ${word}`
}
