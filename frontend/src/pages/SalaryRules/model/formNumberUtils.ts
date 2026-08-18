import type { BorderDraft } from './ruleDraft.ts'

/**
 * Shared number-parsing / error-map plumbing for both rule draft resolvers — `ruleFormSchema.ts`
 * (service, `SalaryRuleRequest`) and `shopRuleFormSchema.ts` (shop, `ShopSalaryRuleRequest`).
 * Extracted here (Фаза 4) so the two resolvers can share it without either importing the other's
 * file for unrelated reasons. This is pure UI-draft parsing with zero dependency on either
 * direction's zod contract — it only ever builds plain JS objects; the actual contract-shape check
 * happens separately in each resolver's own `safeParse` call against that direction's own schema
 * (`salaryRuleRequestSchema` vs `shopSalaryRuleRequestSchema`). Sharing it is the same kind of
 * "shared vocabulary, not business logic" reuse the contracts package itself documents for
 * `targetRoleSchema`/`percentBordersSchema`/`individualBonusFieldSchema` — it does not merge the two
 * discriminated unions, which stay strictly separate.
 */

/** Per-field validation messages, keyed by the input they belong to — the rule form card reads
 * these to show inline errors under the exact field that's wrong, instead of one generic
 * form-level message. `category` is shop-only (`ProductSold`/`UsedProductSold`); unused by the
 * service resolver, kept in the same shared map so both resolvers return the same result shape. */
export type RuleFieldErrors = Partial<
    Record<
        | 'name'
        | 'targetRole'
        | 'awardKind'
        | 'price'
        | 'percent'
        | 'basePercent'
        | 'basePrice'
        | 'salaryBasis'
        | 'bonus'
        | 'thresholds'
        | 'category',
        string
    >
>

/** Accepts both `,` and `.` as the decimal separator (same convention as Фаза 2's rate input, see
 * `SalaryRulesRuleCard.tsx`'s `onRateChange`). Empty/blank input parses to `undefined`, not `NaN`
 * or `0` — callers decide whether a missing value is an error (required field) or fine (optional
 * bonus). */
export function parseNumber(raw: string): number | undefined {
    const trimmed = raw.trim()
    if (trimmed === '') return undefined
    const value = Number(trimmed.replace(',', '.'))
    return Number.isFinite(value) ? value : undefined
}

/**
 * Validates and builds exactly the `percentBorders` tuple both directions' zod schemas expect (the
 * shape is identical — three `{ name, fromPlanPercent, multiplier, mode }` rows — even though the
 * two contracts declare it as separate `z.tuple` literals, see `salary-rule.ts`'s
 * `percentBordersSchema`, reused verbatim by `shop-salary-rule.ts`). `borders.length !== 3` is a
 * real runtime check (not just a TS tuple type) on purpose — the UI enforces "exactly 3"
 * structurally (no add/remove controls), this branch only fires for a future UI regression, but
 * that's exactly the kind of boundary the phase's unit test is meant to catch.
 */
export function buildPercentBorders(
    borders: BorderDraft[],
    errors: RuleFieldErrors,
): { name: string; fromPlanPercent: number; multiplier: number; mode: 'FIX' | 'LINEAR' }[] {
    if (borders.length !== 3) {
        errors.thresholds = `Нужно ровно 3 порога (сейчас ${borders.length})`
        return []
    }

    const built: { name: string; fromPlanPercent: number; multiplier: number; mode: 'FIX' | 'LINEAR' }[] = []
    for (const border of borders) {
        const fromPlanPercent = parseNumber(border.fromPlanPercent)
        const multiplier = parseNumber(border.multiplier)
        if (border.name.trim() === '' || fromPlanPercent === undefined || multiplier === undefined) {
            errors.thresholds = 'Заполните название, % плана и множитель у каждого порога'
            return built
        }
        built.push({ name: border.name.trim(), fromPlanPercent, multiplier, mode: border.mode })
    }
    return built
}
