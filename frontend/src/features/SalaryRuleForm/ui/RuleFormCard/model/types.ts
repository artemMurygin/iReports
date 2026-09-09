import type { CatalogCategoryResponse, OrderTypeResponse, TargetRole } from 'ireports-contracts'

import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { RuleSaveOutcome } from '../../../model/ruleResolver.ts'
import type { BorderDraft, RuleDraft, RuleType } from '../../../model/ruleDraft.ts'

/**
 * Всё, что карточке правила нужно от родителя помимо самого черновика: конфиг направления,
 * справочники и колбэки списка черновиков. Список правил (`core/ui/RuleList`) принимает этот
 * объект одним пропсом и передаёт его карточке как есть — чтобы не перечислять у себя пропсы,
 * которыми сам не пользуется.
 *
 * `orderTypes` (Фаза 5, docs/service-plan-salary-rule-order-category-filter) — в отличие от
 * `categories`, живёт прямо здесь, а не отдельным топ-уровневым пропом `RuleList`/`RuleRow`:
 * свёрнутая строка (`RuleRow`) типы заказов не показывает, справочник нужен только раскрытой
 * карточке.
 */
export type RuleFormCardContext = {
    config: RuleFormConfig
    allowedRolesByType: Partial<Record<RuleType, TargetRole[]>>
    isRoleTypesLoading: boolean
    roleTypesError?: string | null
    isCategoriesLoading?: boolean
    categoriesError?: string | null
    orderTypes: OrderTypeResponse[]
    isOrderTypesLoading?: boolean
    orderTypesError?: string | null
    onChange: (id: string, patch: Partial<RuleDraft>) => void
    onChangeType: (id: string, type: RuleType) => void
    onChangeBorder: (id: string, index: number, patch: Partial<BorderDraft>) => void
    onCancel: () => void
    onSave: () => RuleSaveOutcome | null
    /** `TaskCompletion` only (`TaskCompletionRuleFields`'s "Задача") — opens the task details side
     * panel (`features/TaskStatusControl`'s `TaskDetailsPanel`) for an already-linked task. Optional
     * because every other rule type's `RuleFormCardContext` never reads it — see
     * `useTaskLinkPanels.ts` for where the callback actually comes from. */
    onOpenTask?: (taskId: string) => void
    /** `TaskCompletion` only — opens the task creation side panel (`features/CreateTask`'s
     * `CreateTaskPanel`) for this draft when it has no task yet. See `onOpenTask`'s comment. */
    onCreateTask?: (draftId: string) => void
}

export type RuleFormCardProps = RuleFormCardContext & {
    draft: RuleDraft
    index: number
    categories: CatalogCategoryResponse[]
    onDelete: (id: string) => void
    className?: string
}
