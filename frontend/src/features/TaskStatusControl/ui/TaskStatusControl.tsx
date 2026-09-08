import type { TaskStatus } from 'ireports-contracts'

import { useAssigneeName } from '../model/useAssigneeName.ts'
import { readTransitionErrorMessage } from '../model/api.ts'
import { useTask } from '../model/useTask.ts'
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
    className?: string
}

export function TaskStatusControl({ taskId, onClose, className }: TaskStatusControlProps) {
    const { data: task, isLoading, isError, error } = useTask(taskId)
    const transition = useTaskTransition(taskId)
    const assigneeName = useAssigneeName(task?.assigneeEmployeeId ?? -1)

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
            />
            {transition.isError && (
                <p role="alert" className="px-5 pb-4 font-ui text-xs text-danger">
                    {readTransitionErrorMessage(transition.error)}
                </p>
            )}
        </div>
    )
}
