import type { CatalogCategoryResponse, OrderTypeResponse, TargetRole } from 'ireports-contracts'

import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { RuleSaveOutcome } from '../../../model/ruleResolver.ts'
import type { BorderDraft, RuleDraft, RuleType } from '../../../model/ruleDraft.ts'
import type { WarehouseFieldWarehouse } from '../../WarehouseField'

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
    /** `DepartmentTurnoverBonus` only (FR4 of add-department-head-salary-rules) — the warehouse
     * picklist `RuleFormCardFields.tsx`'s `WarehouseField` branch reads. Optional/defaults to `[]`
     * inside that component so no other rule type or existing caller needs to supply it. */
    warehouses?: WarehouseFieldWarehouse[]
    isWarehousesLoading?: boolean
    warehousesError?: string | null
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
    /** `TaskCompletion` only, add-task-rule-task-lifecycle — deletes ONE ALREADY-PERSISTED rule
     * together with its task, immediately on the backend (`DELETE .../salary-rules/:ruleId`). Used
     * by `TaskCompletionRuleFields`'s "Удалить задачу" only when `draft.ruleId` is set (the rule was
     * loaded from an existing schema, not just added this session) — a `TaskCompletion` rule can't
     * hold a cleared `taskId` in a valid persisted state, so deleting its task deletes the whole
     * rule right away instead of leaving a client-only edit pending a later schema save. `undefined`
     * on the schema-CREATE page (`pages/SalaryRules`), where no rule is persisted yet — every draft
     * there has `ruleId === undefined`, so the callback is never invoked. */
    onDeleteRule?: (ruleId: string) => Promise<void>
    /** Деактивирует уже сохранённое правило (`draft.ruleId` задан) на бэкенде —
     * `POST .../salary-rules/:ruleId/deactivate` (soft-delete: правило перестаёт участвовать в
     * расчётах и пропадает из будущих `GET .../motivation-schema/:id`, см. `isActive` comment в
     * `contracts/commands/salary-rule.ts`). `undefined` на странице создания схемы
     * (`pages/SalaryRules`), где `draft.ruleId` всегда `undefined` — деактивировать там ещё нечего,
     * кнопка не рендерится (см. `RuleFormCardHeader`). В отличие от `onDeleteRule` — применимо к
     * правилу ЛЮБОГО типа, не только `TaskCompletion`, и не трогает связанную с правилом задачу. */
    onDeactivateRule?: (ruleId: string) => Promise<void>
}

export type RuleFormCardProps = RuleFormCardContext & {
    draft: RuleDraft
    index: number
    categories: CatalogCategoryResponse[]
    onDelete: (id: string) => void
    className?: string
}
