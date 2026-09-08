import { CreateTaskForm } from '@/features/CreateTask'
import { Modal } from '@/shared/ui-kit/organisms/Modal.tsx'

export type CreateTaskModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated: (taskId: string) => void
}

/** «Новая задача» — Pencil `iZrrX`'s `RL69s/nce6A` (page header primary action) and `cHCoj`'s
 * `SfIqI` (empty-state CTA) both open this same modal. `CreateTaskForm` is the whole feature
 * (tasks.md группа 11) — this file only supplies the shared `Modal` chrome around it. */
function CreateTaskModal({ open, onOpenChange, onCreated }: CreateTaskModalProps) {
    return (
        <Modal open={open} onOpenChange={onOpenChange} title="Новая задача">
            <CreateTaskForm onCreated={onCreated} />
        </Modal>
    )
}

export { CreateTaskModal }
