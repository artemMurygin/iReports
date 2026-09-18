import type { BorderDraft } from './ruleDraft.ts'

/**
 * Shared number-parsing / error-map plumbing for both rule draft resolvers — `service/model/ruleFormSchema.ts`
 * (service, `SalaryRuleRequest`) and `shop/model/ruleFormSchema.ts` (shop, `ShopSalaryRuleRequest`).
 * Extracted here (Фаза 4) so the two resolvers can share it without either importing the other's
 * file for unrelated reasons. This is pure UI-draft parsing with zero dependency on either
 * direction's zod contract — it only ever builds plain JS objects; the actual contract-shape check
 * happens separately in each resolver's own `safeParse` call against that direction's own schema
 * (`salaryRuleRequestSchema` vs `shopSalaryRuleRequestSchema`). Sharing it is the same kind of
 * "shared vocabulary, not business logic" reuse the contracts package itself documents for
 * `targetRoleSchema`/`percentBordersSchema` — it does not merge the two discriminated unions,
 * which stay strictly separate.
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
        | 'salaryBasis'
        | 'thresholds'
        | 'category'
        | 'description'
        | 'period'
        | 'dueDate'
        // add-department-head-salary-rules (FR3/FR4) — `DepartmentPlanBonus`/`DepartmentTurnoverBonus`'s
        // own required fields, see `ruleAwards.ts`'s `buildDepartmentTurnoverBonusConfig`.
        | 'warehouseId'
        | 'planTurnoverRatio'
        // `FloatPercentMarginFloor`'s own fields ("Продажа товара Б/У", shop `ProductSold`-only),
        // see `shop/model/ruleFormSchema.ts`'s `buildProductSoldMarginFloorAward`.
        | 'marginThreshold'
        | 'floorAmount'
        | 'lowMarginPercent'
        // replace-bitrix-task-integration, раздел 14 tasks.md — `taskId` приходит от мастера
        // (Шаг 1) и в норме уже заполнен к моменту, когда форма правила вообще видна; ошибка тут
        // — защита от регрессии (см. `resolveRuleDraft`'s `case 'TaskCompletion'`), не то, что
        // пользователь может исправить прямо в этом поле (оно readonly). `taskTitleTemplate` —
        // обязателен только когда `isRecurring === true` (см. `TaskCompletionRuleFields.tsx`).
        | 'taskId'
        | 'taskTitleTemplate'
        // add-task-salary-rule-accounting-period — расчётный период первой/текущей задачи
        // правила, выбирается руководителем в `PeriodPicker` (`TaskCompletionRuleFields.tsx`).
        | 'accountingPeriod'
        // recurring-task-deadline-offset, FR1 — «Дедлайн относится к» (0..3 периода вперёд),
        // видим только при `isRecurring === true` (`TaskCompletionRuleFields.tsx`), но структурно
        // всегда число на драфте (default 0), поэтому проверяется как и остальные численные поля.
        | 'deadlinePeriodOffset',
        string
    >
>

/** Accepts both `,` and `.` as the decimal separator (same convention as Фаза 2's rate input, see
 * `SalaryRulesRuleCard.tsx`'s `onRateChange`). Empty/blank input parses to `undefined`, not `NaN`
 * or `0` — callers decide whether a missing value is an error (required field) or fine. */
export function parseNumber(raw: string): number | undefined {
    const trimmed = raw.trim()
    if (trimmed === '') return undefined
    const value = Number(trimmed.replace(',', '.'))
    return Number.isFinite(value) ? value : undefined
}

/**
 * recurring-task-deadline-offset, FR1 — `TaskCompletionRuleFields.tsx`'s day input keeps
 * `RuleDraft.deadlineTemplate` as bare, unpadded digits while typing (`"2000-01-3"`, see that
 * file's `buildDeadlineDayTemplate` comment for why no `padStart` there). This is the one place
 * that normalizes it into an always-valid, zero-padded carrier date (`"2000-01-25"`) before it
 * reaches the wire — call only for a recurring `TaskCompletion` rule's `deadlineTemplate`, never
 * for a one-off rule's (that one is a real, literal date from `CreateTaskForm`, untouched here).
 * Empty input passes through unchanged so the existing `dueDate` required-field check (on the
 * RAW value, before this runs) still fires correctly.
 */
export function normalizeDeadlineDayTemplate(raw: string): string {
    const match = /(\d{1,2})$/.exec(raw)
    if (!match) return raw
    const day = Math.min(Math.max(Number(match[1]), 1), 31)
    return `2000-01-${String(day).padStart(2, '0')}`
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
