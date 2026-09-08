import type { CatalogCategoryResponse } from 'ireports-contracts'
import { RuleFormCard, type RuleDraft, type RuleFormCardContext } from '@/features/SalaryRuleForm'

import type { WizardStep } from '../model/useCreateTaskCompletionRuleWizard.ts'

import { CreateTaskStepCard } from './CreateTaskStepCard.tsx'

export type WizardStepBodyProps = {
    step: WizardStep
    draft: RuleDraft
    index: number
    categories: CatalogCategoryResponse[]
    ruleFormProps: RuleFormCardContext
    onDelete: (id: string) => void
    onTaskCreated: (taskId: string) => void
    className?: string
}

/**
 * Единственное место мастера, которому позволено ветвиться по шагу (frontend/CLAUDE.md,
 * "Медиатор/страница не должен содержать условного рендера" — ветвление выносится в отдельный
 * презентационный компонент; `CreateTaskCompletionRuleWizard.tsx` сам этого не делает).
 *
 * Шаг 2 — это НЕ новая вёрстка: он переиспользует уже существующий `RuleFormCard` как есть (тот
 * же компонент, что рендерит эту карточку при обычном редактировании уже персистентного правила
 * `TaskCompletion`) — к этому моменту `draft.taskId` уже заполнен Шагом 1 (см.
 * `CreateTaskCompletionRuleWizard.tsx`'s `handleTaskCreated`), так что `TaskCompletionRuleFields`
 * показывает его как обычный readonly-виджет уже привязанной задачи.
 */
export function WizardStepBody({
    step,
    draft,
    index,
    categories,
    ruleFormProps,
    onDelete,
    onTaskCreated,
    className,
}: WizardStepBodyProps) {
    return step === 'task' ? (
        <CreateTaskStepCard className={className} onCreated={onTaskCreated} onCancel={ruleFormProps.onCancel} />
    ) : (
        <RuleFormCard
            className={className}
            draft={draft}
            index={index}
            categories={categories}
            onDelete={onDelete}
            {...ruleFormProps}
        />
    )
}
