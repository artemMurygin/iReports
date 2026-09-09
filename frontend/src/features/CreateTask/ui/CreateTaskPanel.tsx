import { SidePanel } from '@/shared/ui-kit/organisms/SidePanel.tsx'

import { CreateTaskForm } from './CreateTaskForm.tsx'

export type CreateTaskPanelProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated: (taskId: string) => void
}

/**
 * `SidePanel` (`shared/ui-kit`) chrome around `CreateTaskForm` — unlike `pages/Tasks`'s
 * `CreateTaskModal` (a centered `Modal`), this is the side-panel presentation
 * `features/SalaryRuleForm`'s task-linking flow uses when creating the task a `TaskCompletion`
 * rule refers to (`TaskCompletionRuleFields`'s "Создать задачу"), so the flow visually matches
 * `TaskDetailsPanel` (`features/TaskStatusControl`) — the panel that opens for an *existing* task.
 * `CreateTaskForm` has no header/close of its own (unlike `TaskStatusCard`), so this supplies a
 * visible `title` instead of `TaskDetailsPanel`'s `srOnlyTitle`.
 */
export function CreateTaskPanel({ open, onOpenChange, onCreated }: CreateTaskPanelProps) {
    return (
        <SidePanel open={open} onOpenChange={onOpenChange} title="Новая задача">
            <div className="p-5">
                <CreateTaskForm onCreated={onCreated} />
            </div>
        </SidePanel>
    )
}
