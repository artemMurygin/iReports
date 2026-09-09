import { SidePanel } from '@/shared/ui-kit/organisms/SidePanel.tsx'

import { TaskStatusControl } from './TaskStatusControl.tsx'

export type TaskDetailsPanelProps = {
    taskId: string | null
    onClose: () => void
}

/**
 * Публичный компонент фичи — `SidePanel` (`shared/ui-kit`) chrome around `TaskStatusControl`.
 * `TaskStatusCard` already renders its own visible title + close button (`X`) inside the panel, so
 * this only supplies a visually-hidden `Dialog.Title` for the accessible name Radix requires, not a
 * second visible header (same reasoning `pages/Tasks/ui/TaskDrawer.tsx` used to have inline before
 * this was promoted into the feature so `pages/SalaryRuleDetail`/`pages/SalaryRules` — which can't
 * import a `pages/Tasks` component, frontend/CLAUDE.md — could reuse it too, see
 * `features/SalaryRuleForm`'s task-linking flow).
 */
export function TaskDetailsPanel({ taskId, onClose }: TaskDetailsPanelProps) {
    return (
        <SidePanel open={taskId !== null} onOpenChange={(open) => !open && onClose()} srOnlyTitle="Карточка задачи">
            {taskId && <TaskStatusControl taskId={taskId} onClose={onClose} />}
        </SidePanel>
    )
}
