import type { Task } from 'ireports-contracts'

import { EmptyState } from './EmptyState.tsx'
import { TaskList } from './TaskList.tsx'

export type TasksBodyProps = {
    tasks: Task[]
    hasTasks: boolean
    onSelect: (taskId: string) => void
    onCreateTask: () => void
}

/** Owns the one conditional (`hasTasks` -> table/cards vs. empty state) that `TasksPage` itself
 * must not (frontend/CLAUDE.md, mediator rule) — Pencil `iZrrX` vs. `cHCoj`. */
function TasksBody({ tasks, hasTasks, onSelect, onCreateTask }: TasksBodyProps) {
    if (!hasTasks) return <EmptyState onCreateTask={onCreateTask} />
    return <TaskList tasks={tasks} onSelect={onSelect} />
}

export { TasksBody }
