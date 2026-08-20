import { ChevronUp, Trash2 } from 'lucide-react'
import type { CatalogCategoryResponse } from 'ireports-contracts'

import { summarizeRuleDraft } from '../../../model/ruleSummary.ts'
import type { RuleDraft } from '../../../model/ruleDraft.ts'

export type RuleFormCardHeaderProps = {
    draft: RuleDraft
    index: number
    categories: CatalogCategoryResponse[]
    onCancel: () => void
    onDelete: () => void
}

/**
 * Шапка раскрытой карточки (Pencil node `F8JNuZ`): бейдж номера, название с мета-строкой
 * (`summarizeRuleDraft` для уже подтверждённого правила, иначе «Новое правило»), сворачивание и
 * удаление. Бейджа роли здесь нет — этот под-узел в макете `enabled: false`, роль показывается
 * только в свёрнутой строке (`core/ui/RuleRow`).
 */
export function RuleFormCardHeader({ draft, index, categories, onCancel, onDelete }: RuleFormCardHeaderProps) {
    return (
        <div className="flex items-center justify-between gap-2.5 rounded-t-[10px] bg-brand-soft p-[10px_12px]">
            <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border border-brand-strong bg-brand-strong font-ui text-[11px] font-semibold text-brand-foreground">
                    {index + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-ui text-[13px] font-semibold text-ink">
                        {draft.name.trim() || `Правило ${index + 1}`}
                    </span>
                    <span className="truncate font-ui text-[11px] text-ink-muted">
                        {draft.confirmed ? summarizeRuleDraft(draft, categories) : 'Новое правило'}
                    </span>
                </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="Свернуть правило"
                    className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                >
                    <ChevronUp className="size-[15px]" />
                </button>
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label="Удалить правило"
                    className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
                >
                    <Trash2 className="size-[15px]" />
                </button>
            </div>
        </div>
    )
}
