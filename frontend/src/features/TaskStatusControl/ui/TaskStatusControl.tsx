import type { TaskDirection, TaskStatus } from 'ireports-contracts'

import { useAssigneeName } from '../model/useAssigneeName.ts'
import { readTransitionErrorMessage } from '../model/api.ts'
import { useTask } from '../model/useTask.ts'
import { useTaskComments } from '../model/useTaskComments.ts'
import { useTaskLinks } from '../model/useTaskLinks.ts'
import { useTaskSalaryReference } from '../model/useTaskSalaryReference.ts'
import { useTaskTransition } from '../model/useTaskTransition.ts'
import { TaskStatusCard } from './TaskStatusCard.tsx'

/**
 * Публичный компонент фичи (реэкспортируется `index.ts`) — orchestrator/model-хук в одном месте,
 * без mediator (один stateful-виджет, тот же приём, что описан для `pages/Tasks` в architecture.md
 * "mediator/-компонент — требуется для SalaryRuleDetail ..., Tasks по-прежнему обходится без
 * mediator"): `useTask`/`useTaskTransition`/`useAssigneeName` вызываются здесь, а не в презентационной
 * `TaskStatusCard`.
 */
export type TaskStatusControlProps = {
    taskId: string
    onClose?: () => void
    /**
     * add-task-salary-rule-links-comments, tasks.md группа 27 — клик по `SalaryRuleSummaryBlock`
     * (`spec: tasks/salary-rule-panel#Requirement: Клик по связанному правилу открывает боковую
     * панель с его описанием`). Без него блок правила рендерится некликабельным (см.
     * `SalaryRuleSummaryBlock`'s `onOpen?`) — оркестрацию открытия панели правила
     * (`features/SalaryRuleDetailsPanel`) берёт на себя вызывающая страница (`pages/Tasks`'s
     * `useSalaryRulePanel`, tasks.md группа 30), не сама фича.
     */
    onOpenSalaryRule?: (args: { ruleId: string; direction: TaskDirection }) => void
    className?: string
}

export function TaskStatusControl({ taskId, onClose, onOpenSalaryRule, className }: TaskStatusControlProps) {
    const { data: task, isLoading, isError, error } = useTask(taskId)
    const transition = useTaskTransition(taskId)
    const assigneeName = useAssigneeName(task?.assigneeEmployeeId ?? -1)
    const { comments, addComment, isAdding } = useTaskComments(taskId)
    const { links, addLink, removeLink } = useTaskLinks(taskId)
    const salaryReference = useTaskSalaryReference({ id: taskId, direction: task?.direction ?? null })

    if (isLoading) {
        return (
            <div data-slot="task-status-control-loading" className="p-5 font-ui text-sm text-ink-muted">
                Загрузка задачи…
            </div>
        )
    }

    if (isError || !task) {
        return (
            <div data-slot="task-status-control-error" className="p-5 font-ui text-sm text-danger">
                {error instanceof Error ? error.message : 'Не удалось загрузить задачу'}
            </div>
        )
    }

    const handleTransition = (targetStatus: TaskStatus) => {
        transition.mutate(targetStatus)
    }

    return (
        <div data-slot="task-status-control" className={className}>
            <TaskStatusCard
                task={task}
                assigneeName={assigneeName}
                isTransitionPending={transition.isPending}
                onTransition={handleTransition}
                onClose={onClose}
                comments={comments}
                onAddComment={addComment}
                isAddingComment={isAdding}
                links={links}
                onAddLink={addLink}
                onRemoveLink={removeLink}
                salaryRuleSummary={salaryReference.rule}
                salaryAccrual={salaryReference.accrual}
                salaryRuleDirection={salaryReference.direction}
                onOpenSalaryRule={onOpenSalaryRule}
            />
            {transition.isError && (
                <p role="alert" className="px-5 pb-4 font-ui text-xs text-danger">
                    {readTransitionErrorMessage(transition.error)}
                </p>
            )}
        </div>
    )
}
