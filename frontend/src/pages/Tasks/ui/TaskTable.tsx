import { ChevronRight } from 'lucide-react'
import type { Task, TaskDirection } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { TaskStatusBadge } from '@/shared/ui-kit/atoms/TaskStatusBadge.tsx'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'

import { formatDeadline } from '../model/formatDeadline.ts'
import { initialsOf } from '../model/employeeLookup.ts'

const DIRECTION_LABEL: Record<TaskDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

const COLUMN_WIDTH = {
    assignee: 'w-[200px]',
    deadline: 'w-[120px]',
    status: 'w-[170px]',
    actions: 'w-[80px]',
}

export type TaskTableProps = {
    tasks: Task[]
    employeeNameById: Map<number, string>
    onSelect: (taskId: string) => void
    className?: string
}

/**
 * Desktop table, Pencil `iZrrX` -> `x6A16u` (Task Table): Задача (title + direction meta) ·
 * Ответственный (avatar + name) · Дедлайн · Статус · Actions (open). `Task` doesn't carry a
 * "разовая/регулярная" attribute (design.md решение 2 — that's `SalaryRule`'s, not the task's own),
 * so the meta line under the title shows only direction, unlike the mockup's illustrative
 * "Сервис · регулярная" copy (see `TaskStatusCard.tsx`'s identical WHY).
 */
function TaskTable({ tasks, employeeNameById, onSelect, className }: TaskTableProps) {
    return (
        <div
            data-slot="task-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div className="min-w-[860px]">
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        <ColumnHeader label="Задача" className="min-w-[280px] flex-1" />
                        <ColumnHeader label="Ответственный" className={COLUMN_WIDTH.assignee} />
                        <ColumnHeader label="Дедлайн" className={COLUMN_WIDTH.deadline} />
                        <ColumnHeader label="Статус" className={COLUMN_WIDTH.status} />
                        <div className={cn('h-10 shrink-0', COLUMN_WIDTH.actions)} />
                    </div>

                    {tasks.map((task) => (
                        <TaskTableRow
                            key={task.id}
                            task={task}
                            assigneeName={employeeNameById.get(task.assigneeEmployeeId)}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

function TaskTableRow({
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
        <div data-slot="task-table-row" className="flex items-center border-b border-hairline last:border-b-0">
            <div className="min-w-[280px] flex-1 px-3 py-3.5">
                <p className="truncate font-ui text-sm font-semibold text-ink">{task.title}</p>
                {task.direction && (
                    <p className="mt-0.5 truncate font-ui text-xs text-ink-muted">{DIRECTION_LABEL[task.direction]}</p>
                )}
            </div>

            <div className={cn('flex shrink-0 items-center gap-2 px-3', COLUMN_WIDTH.assignee)}>
                <Avatar size="sm">
                    <AvatarFallback>{initialsOf(assigneeLabel)}</AvatarFallback>
                </Avatar>
                <span className="truncate font-ui text-sm text-ink">{assigneeLabel}</span>
            </div>

            <span className={cn('shrink-0 px-3 font-ui text-sm text-ink-muted tabular-nums', COLUMN_WIDTH.deadline)}>
                {formatDeadline(task.deadline)}
            </span>

            <div className={cn('shrink-0 px-3', COLUMN_WIDTH.status)}>
                <TaskStatusBadge status={task.status} />
            </div>

            <div className={cn('flex shrink-0 items-center justify-end px-3', COLUMN_WIDTH.actions)}>
                <IconButton aria-label={`Открыть задачу «${task.title}»`} onClick={() => onSelect(task.id)}>
                    <ChevronRight />
                </IconButton>
            </div>
        </div>
    )
}

export { TaskTable }
