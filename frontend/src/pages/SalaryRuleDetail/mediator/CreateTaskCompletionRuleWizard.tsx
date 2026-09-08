import type { CatalogCategoryResponse } from 'ireports-contracts'
import type { RuleDraft, RuleFormCardContext } from '@/features/SalaryRuleForm'

import { useCreateTaskCompletionRuleWizard } from './model/useCreateTaskCompletionRuleWizard.ts'
import { WizardStepBody } from './ui/WizardStepBody.tsx'

export type CreateTaskCompletionRuleWizardProps = {
    /** Черновик правила, ради которого открыт мастер — свежедобавленный/только что переключённый
     * на `TaskCompletion` и ещё НЕ ПОДТВЕРЖДЁННЫЙ (`type === 'TaskCompletion'`, `!confirmed`, см.
     * `pages/SalaryRuleDetail`'s `useServiceSchemaEditForm.ts`'s `wizardDraft`, tasks.md раздел
     * 14.6) — мастер остаётся смонтированным на протяжении ОБОИХ шагов, `draft.taskId` внутри
     * него меняется с `''` на реальный id ровно один раз, между Шагом 1 и Шагом 2. */
    draft: RuleDraft
    index: number
    categories: CatalogCategoryResponse[]
    /** Тот же объект, что `RuleList` передаёт `RuleFormCard` (`core/ui/RuleFormCard`'s
     * `RuleFormCardContext`) — мастер не заводит собственных версий `onChange`/`onSave`/`onCancel`,
     * переиспользует уже существующий стейт редактирования схемы (`useSalaryRulesDraft`). */
    ruleFormProps: RuleFormCardContext
    onDelete: (id: string) => void
    className?: string
}

/**
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.1/14.3), architecture.md's
 * `CreateTaskCompletionRuleWizard` — 2-шаговый мастер создания правила `TaskCompletion`:
 * оркеструет 2 stateful-виджета (Шаг 1 — создание задачи, `features/CreateTask`; Шаг 2 — форма
 * правила, уже существующий `RuleFormCard`, переиспользующий стейт `useSalaryRulesDraft`
 * родителя) и НЕ содержит условного рендера сам (frontend/CLAUDE.md) — ветвление шага целиком
 * в презентационном `ui/WizardStepBody.tsx`.
 *
 * Единственная бизнес-логика этого компонента — сама проводка "задача создана -> запиши её id в
 * черновик правила -> покажи Шаг 2", и та тривиальна (`handleTaskCreated`): она не решает, ЧТО
 * такое taskId и не валидирует его — просто прокидывает значение, полученное от `CreateTaskForm`,
 * дальше в уже существующий `ruleFormProps.onChange`.
 */
export function CreateTaskCompletionRuleWizard({
    draft,
    index,
    categories,
    ruleFormProps,
    onDelete,
    className,
}: CreateTaskCompletionRuleWizardProps) {
    const wizard = useCreateTaskCompletionRuleWizard()

    function handleTaskCreated(taskId: string) {
        ruleFormProps.onChange(draft.draftId, { taskId })
        wizard.goToRuleStep(taskId)
    }

    return (
        <WizardStepBody
            className={className}
            step={wizard.step}
            draft={draft}
            index={index}
            categories={categories}
            ruleFormProps={ruleFormProps}
            onDelete={onDelete}
            onTaskCreated={handleTaskCreated}
        />
    )
}
