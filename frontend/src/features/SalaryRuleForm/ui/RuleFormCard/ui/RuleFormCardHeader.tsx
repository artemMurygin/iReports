import { Ban, ChevronUp, Trash2 } from 'lucide-react'
import type { CatalogCategoryResponse } from 'ireports-contracts'

import { useDeactivateRule } from '../../../model/useDeactivateRule.ts'
import { summarizeRuleDraft } from '../../../model/ruleSummary.ts'
import type { RuleDraft } from '../../../model/ruleDraft.ts'

import { DeactivateRuleDialog } from './DeactivateRuleDialog.tsx'

export type RuleFormCardHeaderProps = {
    draft: RuleDraft
    index: number
    categories: CatalogCategoryResponse[]
    onCancel: () => void
    onDelete: () => void
    /** Деактивирует ЭТО правило на бэкенде (`RuleFormCardContext.onDeactivateRule`, см. его
     * comment) — `undefined` на странице создания схемы, где `draft.ruleId` ещё не задано ни у
     * одного черновика: там деактивировать нечего, кнопка не рендерится вовсе (см. `canDeactivate`
     * ниже). В отличие от `onDeleteRule` (только `TaskCompletion`, из тела карточки), применимо к
     * правилу любого типа — поэтому живёт здесь, в шапке, общей для всех типов. */
    onDeactivateRule?: (ruleId: string) => Promise<void>
}

/**
 * Шапка раскрытой карточки (Pencil node `F8JNuZ`): бейдж номера, название с мета-строкой
 * (`summarizeRuleDraft` для уже подтверждённого правила, иначе «Новое правило»), сворачивание,
 * деактивация и удаление. Бейджа роли здесь нет — этот под-узел в макете `enabled: false`, роль
 * показывается только в свёрнутой строке (`core/ui/RuleRow`).
 *
 * «Деактивировать» (soft-delete уже сохранённого правила, `POST .../salary-rules/:ruleId/deactivate`)
 * рендерится только когда есть ЧТО деактивировать и ЧЕМ (`draft.ruleId` задан И `onDeactivateRule`
 * передан родителем) — confirm через `DeactivateRuleDialog`/`useDeactivateRule`, тот же паттерн
 * confirm/pending/error, что и «Удалить задачу» в `TaskCompletionRuleFields.tsx`. После успеха
 * бэкенд перестаёт отдавать правило в `GET .../motivation-schema/:id` (см. `isActive` comment в
 * `contracts/commands/salary-rule.ts`), но локальный список черновиков не синхронизируется с фоновым
 * рефетчем (см. `useServiceSchemaEditForm.ts`'s WHY про `initialDrafts`) — поэтому карточку убираем
 * сразу тем же `onDelete`, что и обычное локальное удаление черновика.
 */
export function RuleFormCardHeader({ draft, index, categories, onCancel, onDelete, onDeactivateRule }: RuleFormCardHeaderProps) {
    const deactivate = useDeactivateRule()
    const ruleName = draft.name.trim() || `Правило ${index + 1}`
    const canDeactivate = draft.ruleId !== undefined && onDeactivateRule !== undefined

    async function handleConfirmDeactivate() {
        if (draft.ruleId === undefined) return
        await onDeactivateRule?.(draft.ruleId)
        onDelete()
    }

    return (
        <>
            <div className="flex items-center justify-between gap-2.5 rounded-t-[10px] bg-brand-soft p-[10px_12px]">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border border-brand-strong bg-brand-strong font-ui text-[11px] font-semibold text-brand-foreground">
                        {index + 1}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate font-ui text-[13px] font-semibold text-ink">{ruleName}</span>
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
                    {canDeactivate && (
                        <button
                            type="button"
                            onClick={() => deactivate.open()}
                            aria-label="Деактивировать правило"
                            className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                        >
                            <Ban className="size-[15px]" />
                        </button>
                    )}
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

            {canDeactivate && (
                <DeactivateRuleDialog
                    open={deactivate.isOpen}
                    onOpenChange={(open) => !open && deactivate.close()}
                    ruleName={ruleName}
                    onConfirm={() => deactivate.confirm(handleConfirmDeactivate)}
                    isPending={deactivate.isPending}
                    error={deactivate.error}
                />
            )}
        </>
    )
}
