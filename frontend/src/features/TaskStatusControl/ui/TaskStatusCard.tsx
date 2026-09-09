import { BadgeCheck, BadgeX, Layers, X } from 'lucide-react'
import type { Task, TaskDirection, TaskStatus } from 'ireports-contracts'

import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar.tsx'
import { Chip } from '@/shared/ui-kit/atoms/Chip.tsx'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton.tsx'
import { TaskStatusBadge } from '@/shared/ui-kit/atoms/TaskStatusBadge.tsx'
import { cn } from '@/shared/lib/tw'

import { TaskTransitionActions } from './TaskTransitionActions.tsx'

/**
 * Pencil: `kf1uq` (Ответственный · В работе), `QpFcx` (Руководитель · Выполнена), `yZE5X`
 * (терминальный статус — «Закрыта успешно», расцветка для «Закрыто неуспешно» по danger-палитре,
 * см. ui-design.md «Отклонения»), `cmZjM` (мобильный — тот же контент, `md:`-раскладка вместо
 * отдельного Sheet-компонента: `pages/Tasks`/`SalaryRuleDetail` сами решают, оборачивать ли эту
 * карточку в Drawer или BottomSheet, `TaskStatusControl` — только её содержимое, см. architecture.md
 * "TaskStatusControl (карточка задачи: статус + доступные действия перехода)").
 *
 * `Task` не хранит "разовая/регулярная" — это атрибут `SalaryRule`, не задачи (design.md решение 2),
 * поэтому подзаголовок ("Сервис · дедлайн 25.08.2026" в тексте Pencil-макета) не воспроизводит
 * "регулярная задача" — этих данных здесь по конструкции нет.
 */
const DIRECTION_LABEL: Record<TaskDirection, string> = {
    service: 'Сервис',
    shop: 'Шоп',
}

// `Task.deadline` — тип `Date` в ireports-contracts (`z.coerce.date()` в схеме ответа), но фронт не
// прогоняет ответы API через эту схему — по факту это ISO-строка из JSON, не `Date` (тот же случай,
// что `transaction.occurredAt` в `TransactionsLedger.tsx`), поэтому оборачиваем в `new Date(...)`.
function formatDeadline(deadline: Date | string): string {
    return new Date(deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/)
    return parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('')
}

const TERMINAL_NOTE: Partial<Record<TaskStatus, { text: string; tone: 'brand' | 'danger' }>> = {
    CLOSED_SUCCESSFULLY: {
        text: 'Задача закрыта успешно — начисление по связанному правилу доступно',
        tone: 'brand',
    },
    CLOSED_UNSUCCESSFULLY: {
        text: 'Задача закрыта неуспешно — начисление по связанному правилу недоступно',
        tone: 'danger',
    },
}

export type TaskStatusCardProps = {
    task: Task
    assigneeName?: string
    isTransitionPending?: boolean
    onTransition: (targetStatus: TaskStatus) => void
    onClose?: () => void
    className?: string
}

export function TaskStatusCard({
    task,
    assigneeName,
    isTransitionPending = false,
    onTransition,
    onClose,
    className,
}: TaskStatusCardProps) {
    const assigneeLabel = assigneeName ?? `Сотрудник #${task.assigneeEmployeeId}`
    const terminalNote = TERMINAL_NOTE[task.status]

    return (
        <div data-slot="task-status-card" className={cn('flex w-full flex-col bg-surface md:w-[460px]', className)}>
            <div className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-base font-semibold text-ink">{task.title}</h2>
                    <p className="mt-1.5 truncate font-ui text-xs text-ink-muted">
                        {task.direction ? `${DIRECTION_LABEL[task.direction]} · ` : ''}дедлайн{' '}
                        {formatDeadline(task.deadline)}
                    </p>
                </div>
                {onClose && (
                    <IconButton aria-label="Закрыть карточку задачи" onClick={onClose}>
                        <X />
                    </IconButton>
                )}
            </div>

            <div className="flex flex-col gap-5 px-5 pb-5">
                <div className="flex items-center justify-between gap-2">
                    <TaskStatusBadge status={task.status} className="px-3 py-1.5 text-[13px]" />
                    {task.direction && <Chip icon={<Layers />}>{DIRECTION_LABEL[task.direction]}</Chip>}
                </div>

                <div>
                    <p className="font-ui text-xs text-ink-muted">Описание</p>
                    <p className="mt-1 font-ui text-sm text-ink">{task.description || 'Без описания'}</p>
                </div>

                <div className="flex gap-6">
                    <div>
                        <p className="font-ui text-xs text-ink-muted">Дедлайн</p>
                        <p className="mt-1 font-ui text-sm text-ink">{formatDeadline(task.deadline)}</p>
                    </div>
                    <div>
                        <p className="font-ui text-xs text-ink-muted">Ответственный</p>
                        <div className="mt-1 flex items-center gap-2">
                            <Avatar size="sm">
                                <AvatarFallback>{initialsOf(assigneeLabel)}</AvatarFallback>
                            </Avatar>
                            <span className="font-ui text-sm text-ink">{assigneeLabel}</span>
                        </div>
                    </div>
                </div>

                <div className="h-px w-full bg-hairline" />

                {terminalNote ? (
                    <div
                        className={cn(
                            'flex items-center gap-2.5 rounded-lg p-3.5',
                            terminalNote.tone === 'brand' ? 'bg-brand-soft text-ok-ink' : 'bg-danger-soft text-danger',
                        )}
                    >
                        {terminalNote.tone === 'brand' ? (
                            <BadgeCheck className="size-[18px] shrink-0" />
                        ) : (
                            <BadgeX className="size-[18px] shrink-0" />
                        )}
                        <p className="font-ui text-xs leading-snug font-medium">{terminalNote.text}</p>
                    </div>
                ) : (
                    <TaskTransitionActions
                        status={task.status}
                        onTransition={onTransition}
                        isPending={isTransitionPending}
                    />
                )}
            </div>
        </div>
    )
}
