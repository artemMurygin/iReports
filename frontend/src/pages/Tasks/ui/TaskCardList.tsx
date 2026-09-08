import type { Task, TaskDirection } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { TaskStatusBadge } from '@/shared/ui-kit/atoms/TaskStatusBadge.tsx'

import { formatDeadline } from '../model/formatDeadline.ts'
import { initialsOf } from '../model/employeeLookup.ts'

const DIRECTION_LABEL: Record<TaskDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

export type TaskCardListProps = {
    tasks: Task[]
    employeeNameById: Map<number, string>
    onSelect: (taskId: string) => void
    className?: string
}

/** Mobile card list, Pencil `JlkUN` -> `GfaIs` (Body): one card per task instead of a table row
 * (no search box on this breakpoint per the mockup — only the two filter chips, see ui-design.md
 * «Отклонения»; the page's search input stays desktop-only for the same reason). */
function TaskCardList({ tasks, employeeNameById, onSelect, className }: TaskCardListProps) {
    return (
        <div data-slot="task-card-list" className={cn('flex flex-col gap-2.5', className)}>
            {tasks.map((task) => (
                <TaskCard
                    key={task.id}
                    task={task}
                    assigneeName={employeeNameById.get(task.assigneeEmployeeId)}
                    onSelect={onSelect}
                />
            ))}
        </div>
    )
}

function TaskCard({
    task,
    assigneeName,
    onSelect,
}: {
    task: Task
    assigneeName?: string
    onSelect: (taskId: string) => void
}) {
    const assigneeLabel = assigneeName ?? `Сотрудник #${task.assigneeEmployeeId}`

    return (
        <button
            type="button"
            data-slot="task-card"
            onClick={() => onSelect(task.id)}
            className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-3.5 text-left transition-colors hover:bg-canvas"
        >
            <p className="truncate font-ui text-sm font-semibold text-ink">{task.title}</p>
            {task.direction && (
                <p className="truncate font-ui text-xs text-ink-muted">{DIRECTION_LABEL[task.direction]}</p>
            )}

            <div className="mt-1 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <Avatar size="sm">
                        <AvatarFallback>{initialsOf(assigneeLabel)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate font-ui text-xs text-ink-muted tabular-nums">
                        {formatDeadline(task.deadline)}
                    </span>
                </div>
                <TaskStatusBadge status={task.status} />
            </div>
        </button>
    )
}

export { TaskCardList }
