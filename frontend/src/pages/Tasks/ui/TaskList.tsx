import { useQuery } from '@tanstack/react-query'
import type { Task } from 'ireports-contracts'

import { tasksApi } from '../model/api.ts'
import { buildEmployeeNameById } from '../model/employeeLookup.ts'
import { TaskCardList } from './TaskCardList.tsx'
import { TaskTable } from './TaskTable.tsx'

export type TaskListProps = {
    tasks: Task[]
    onSelect: (taskId: string) => void
    className?: string
}

/**
 * architecture.md: `TaskList { tasks: Task[], onSelect }` — the page's list body. Desktop table
 * (Pencil `iZrrX`) and mobile card list (`JlkUN`) switch purely on Tailwind breakpoints, matching
 * `EmployeeSettlements`'s `EmployeeSettlementsTable`/`EmployeeSettlementsCardList` split. Owns its
 * own employee-directory fetch (same duplication precedent as `features/CreateTask`/
 * `features/TaskStatusControl`, see `model/api.ts`'s WHY) purely to resolve
 * `Task.assigneeEmployeeId` into a display name/initials — a self-contained widget like
 * `features/TaskStatusControl/ui/TaskStatusControl.tsx`, not a `pages/Tasks` mediator concern.
 */
function TaskList({ tasks, onSelect, className }: TaskListProps) {
    const { data: employees } = useQuery(tasksApi.getAssigneeEmployees())
    const employeeNameById = buildEmployeeNameById(employees ?? [])

    return (
        <div data-slot="task-list" className={className}>
            <TaskTable
                tasks={tasks}
                employeeNameById={employeeNameById}
                onSelect={onSelect}
                className="hidden md:block"
            />
            <TaskCardList tasks={tasks} employeeNameById={employeeNameById} onSelect={onSelect} className="md:hidden" />
        </div>
    )
}

export { TaskList }
