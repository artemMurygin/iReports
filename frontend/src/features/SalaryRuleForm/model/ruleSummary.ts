import type { CatalogCategoryResponse } from 'ireports-contracts'

import { pluralizeRules } from '@/kernel/pluralizeRules.ts'

import { findCategoryNode } from './catalogTree.ts'
import { SALARY_BASIS_LABELS } from './ruleFormConfig.ts'
import type { BorderDraft, RuleDraft } from './ruleDraft.ts'

/**
 * `pluralizeRules` moved to `kernel/pluralizeRules.ts` (needed by `pages/SalaryRuleList`'s schema
 * card too) — re-exported here so this file's existing consumer (`ui/TargetCard`) keeps
 * working unchanged.
 */
export { pluralizeRules }

function formatNumber(raw: string): string {
    const value = Number(raw.trim().replace(',', '.'))
    return Number.isFinite(value) ? String(value).replace('.', ',') : '—'
}

function formatMultiplier(raw: string): string {
    const value = Number(raw.trim().replace(',', '.'))
    return Number.isFinite(value) ? value.toFixed(1).replace('.', ',') : '—'
}

function summarizeAward(draft: RuleDraft): string {
    switch (draft.awardKind) {
        case 'Fixed':
            return `Фиксированная сумма ${formatNumber(draft.price)} ₽`
        case 'ServiceFixed':
            return 'Ставка из справочника услуги'
        case 'ServicePercent':
            return `${formatNumber(draft.percent)}% от стоимости услуги`
        case 'FixedPercent':
            return `${formatNumber(draft.percent)}% от базы «${draft.salaryBasis ? SALARY_BASIS_LABELS[draft.salaryBasis] : '—'}»`
        case 'FloatPercent':
            return `Плавающий процент, база ${formatNumber(draft.basePercent)}%`
        default:
            return 'Вариант награды не выбран'
    }
}

/** Collapsed rule row's "Meta" line (Pencil `tSYIw`, e.g. `VpJbo/PaGOR`: `"450 ₽ за час · без
 * варианта награды"`, `tfeLV/PaGOR`: `"Фиксированная сумма 300 ₽"`; shop mockup
 * `ZMEof` → `bLrBy/PaGOR`: `"Фиксированный процент 6% от маржи · все категории"`) — award/config
 * summary, plus a `· <категория>` segment for `ProductSold`/`UsedProductSold` (Фаза 4, shop only).
 * `PayPerHour` has no award choice at all, so its second segment is always the mockup's literal
 * "без варианта награды" rather than an award summary.
 *
 * `categories` — the catalog tree (`GET /v1/shop/warehouse/catalog`), used to resolve `draft.category`
 * to a human name; omitted/empty for service rows, which never read it (`draft.type` is never
 * `ProductSold`/`UsedProductSold` there). */
export function summarizeRuleDraft(draft: RuleDraft, categories: CatalogCategoryResponse[] = []): string {
    if (draft.type === 'PayPerHour') {
        return `${formatNumber(draft.price)} ₽ за час · без варианта награды`
    }

    // TaskCompleted (change salary-rule-bitrix-task) — задача Bitrix24, а не award-union
    // (design.md, Decision 2): своя сводка вместо `summarizeAward`, тот же приём, что и у
    // `PayPerHour` выше.
    if (draft.type === 'TaskCompleted') {
        const recurrence = draft.isRecurring ? 'регулярная' : 'разовая'
        return `${formatNumber(draft.price)} ₽ за задачу · ${recurrence}`
    }

    const parts = [summarizeAward(draft)]

    if (draft.type === 'ProductSold' || draft.type === 'UsedProductSold') {
        parts.push(
            draft.category === null
                ? 'все категории'
                : (findCategoryNode(categories, draft.category)?.name ?? draft.category),
        )
    }

    return parts.join(' · ')
}

/** `ThresholdsEditor`'s collapsed-state summary (Pencil `tSYIw` → `Пороги · Свёрнуто` → `Summary`:
 * `"До 80% плана — 0,6 · 80–110% — 1,0 · от 110% — 1,4"`) — built from the fixed 3-row shape:
 * "before the 2nd row's threshold" uses the 1st row's multiplier, "between rows 2 and 3" uses the
 * 2nd, "from the 3rd row's threshold up" uses the 3rd. */
export function summarizeBorders(borders: BorderDraft[]): string {
    if (borders.length !== 3) return 'Настройте 3 порога плана'
    const [below, plan, over] = borders as [BorderDraft, BorderDraft, BorderDraft]
    return `До ${formatNumber(plan.fromPlanPercent)}% плана — ${formatMultiplier(below.multiplier)} · ${formatNumber(plan.fromPlanPercent)}–${formatNumber(over.fromPlanPercent)}% — ${formatMultiplier(plan.multiplier)} · от ${formatNumber(over.fromPlanPercent)}% — ${formatMultiplier(over.multiplier)}`
}
