import { ChevronDown, Trash2 } from 'lucide-react'
import type { CatalogCategoryResponse, TargetRole } from 'ireports-contracts'

import { ROLE_LABELS } from '../model/roleLabels.ts'
import { summarizeRuleDraft } from '../model/ruleSummary.ts'
import type { RuleDraft } from '../model/ruleDraft.ts'

export type SalaryRulesRuleRowProps = {
    draft: RuleDraft
    index: number
    /** Catalog tree (Фаза 4) — resolves `draft.category` to a name in the summary line for
     * `ProductSold`/`UsedProductSold` shop rows; empty/omitted for service rows, which never read
     * it. See `summarizeRuleDraft`. */
    categories?: CatalogCategoryResponse[]
    onExpand: () => void
    onDelete: () => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` → `Список правил` → `Правило N ·
 * Свёрнуто` (e.g. `VpJbo`) for desktop — index badge, name + `summarizeRuleDraft` meta line, role
 * badge, expand chevron, delete. Only rendered for `confirmed` drafts (the one unconfirmed/new
 * draft always renders as `SalaryRulesRuleFormCard` instead — see `SalaryRulesRuleList.tsx`).
 *
 * Фаза 5 (mobile): node `IScAL`'s collapsed rows (e.g. `txeqw`) drop both the separate role badge
 * chip and the delete icon — the role is folded into the meta line instead (`"450 ₽ за час ·
 * Инженер"`) and delete only reappears once the row is expanded into `SalaryRulesRuleFormCard`
 * (which keeps its own delete icon on every breakpoint). Same `summarizeRuleDraft` call, just two
 * renderings of the meta line (`hidden md:block` without the role / `md:hidden` with it appended)
 * switched by breakpoint rather than a second copy of the summary logic.
 */
export function SalaryRulesRuleRow({ draft, index, categories = [], onExpand, onDelete, className }: SalaryRulesRuleRowProps) {
    const roleLabel = draft.targetRole ? ROLE_LABELS[draft.targetRole as TargetRole] : '—'
    const summary = summarizeRuleDraft(draft, categories)

    return (
        <div className={className}>
            <div className="flex w-full items-center gap-2.5 rounded-[10px] border border-hairline bg-surface p-[10px_12px]">
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-surface font-ui text-[11px] font-semibold text-ink-muted">
                    {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-ui text-[13px] font-semibold text-ink">{draft.name.trim() || `Правило ${index + 1}`}</span>
                    <span className="hidden truncate font-ui text-[11px] text-ink-muted md:block">{summary}</span>
                    <span className="truncate font-ui text-[11px] text-ink-muted md:hidden">
                        {roleLabel === '—' ? summary : `${summary} · ${roleLabel}`}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <span className="hidden rounded-[6px] bg-canvas px-2 py-[3px] font-ui text-[11px] font-semibold text-ink-muted md:inline-flex">
                        {roleLabel}
                    </span>
                    <button
                        type="button"
                        onClick={onExpand}
                        aria-label="Редактировать правило"
                        className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
                    >
                        <ChevronDown className="size-[15px]" />
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        aria-label="Удалить правило"
                        className="hidden size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger md:flex"
                    >
                        <Trash2 className="size-[15px]" />
                    </button>
                </div>
            </div>
        </div>
    )
}
