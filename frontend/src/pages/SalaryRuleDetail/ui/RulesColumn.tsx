import type { ReactNode } from 'react'
import type { CatalogCategoryResponse } from 'ireports-contracts'
import type { RuleDraft, RuleFormCardContext } from '@/features/SalaryRuleForm'

import { CreateTaskCompletionRuleWizard } from '../mediator/CreateTaskCompletionRuleWizard.tsx'

export type RulesColumnProps = {
    /** Обычный список правил (`<RuleList .../>`), собранный `ServiceSchemaEditForm.tsx`/
     * `ShopSchemaEditForm.tsx` как есть — рендерится, когда мастер не нужен. */
    rules: ReactNode
    /** Черновик, ради которого нужно открыть мастер, или `null` (см. `wizardDraft`'s комментарий в
     * `useServiceSchemaEditForm.ts`/`useShopSchemaEditForm.ts`) — именно это поле решает, что
     * показать, а не мандатор выше. */
    wizardDraft: RuleDraft | null
    wizardIndex: number
    categories: CatalogCategoryResponse[]
    ruleFormProps: RuleFormCardContext
    onDeleteDraft: (id: string) => void
    className?: string
}

/**
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.6) — единственное место, которому
 * разрешено решать "мастер или обычный список" (frontend/CLAUDE.md, "Медиатор/страница не должен
 * содержать условного рендера" — ветвление вынесено сюда именно ПОТОМУ, что мандаторы
 * (`ServiceSchemaEditForm.tsx`/`ShopSchemaEditForm.tsx`) не могут его содержать сами). Пока
 * `wizardDraft` не `null` — правая колонка страницы (Pencil `FwNov`/`EdCuh`, «Колонка · Правило»)
 * ПОЛНОСТЬЮ заменяется мастером, а не показывает его как ещё одну раскрытую строку списка (см.
 * ui-design.md: "правая колонка полностью заменена") — весь остальной список правил временно
 * скрыт, пока пользователь не пройдёт оба шага или не отменит.
 */
export function RulesColumn({
    rules,
    wizardDraft,
    wizardIndex,
    categories,
    ruleFormProps,
    onDeleteDraft,
    className,
}: RulesColumnProps) {
    return (
        <div className={className}>
            {wizardDraft ? (
                <CreateTaskCompletionRuleWizard
                    draft={wizardDraft}
                    index={wizardIndex}
                    categories={categories}
                    ruleFormProps={ruleFormProps}
                    onDelete={onDeleteDraft}
                />
            ) : (
                rules
            )}
        </div>
    )
}
