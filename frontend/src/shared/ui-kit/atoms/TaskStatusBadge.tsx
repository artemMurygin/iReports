import type { TaskStatus } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

/**
 * replace-bitrix-task-integration, tasks.md группа 10 (design.md решение 3, specs/tasks/spec.md
 * «Жизненный цикл статуса задачи») — единый визуальный индикатор статуса самостоятельной сущности
 * «Задача» (`TaskStatus`, 6 значений из `ireports-contracts`), переиспользуется в `TaskStatusControl`
 * (группа 12), `RuleSourcesRail` (группа 15) и `TaskList` (группа 13, все — по прецеденту в другом
 * слое, эта функция и компонент их не импортируют).
 *
 * Не расширяет `tone` у `shared/ui-kit/atoms/Badge.tsx`, а собран из уже существующей геометрии
 * пилюли поверх собственного `TASK_STATUS_BADGE_VARIANT`-record — тот же приём, что и у
 * `shared/ui-kit/molecules/CellStatus.tsx` (`SalesPlanStatus` -> {label, className}) и
 * `features/SalaryAccruals/ui/TaskStatusBadge.tsx` (не трогается этой задачей — отдельный бейдж для
 * трёхстатусного `TaskCompletionStatus` правила `TaskCompletion`, живёт в своём слое `features/`).
 *
 * Расцветки сверены с `design/sallary-first-iteration.pen`, фрейм «Задачи · Список» (`iZrrX`) —
 * badge-инстансы `dLETE` (Новая), `ng528` (В работе), `C5tR7x` (Выполнена), `FvAr9` (Закрыта
 * успешно), `T80Uy` (Закрыто неуспешно), `lXemm` (На доработку); все шесть пар токенов уже заведены
 * в `shared/ui-kit/tokens/theme.css`, новых токенов эта задача не добавляет.
 */
export type TaskStatusBadgeVariant = {
    label: string
    className: string
}

export const TASK_STATUS_BADGE_VARIANT: Record<TaskStatus, TaskStatusBadgeVariant> = {
    NEW: { label: 'Новая', className: 'bg-canvas text-ink-muted' },
    IN_PROGRESS: { label: 'В работе', className: 'bg-info-soft text-info-ink' },
    DONE: { label: 'Выполнена', className: 'bg-warn-soft text-warn-ink' },
    CLOSED_SUCCESSFULLY: { label: 'Закрыта успешно', className: 'bg-brand-soft text-ok-ink' },
    CLOSED_UNSUCCESSFULLY: { label: 'Закрыто неуспешно', className: 'bg-danger-soft text-danger' },
    REWORK: { label: 'На доработку', className: 'bg-violet-soft text-violet-ink' },
}

export function getTaskStatusBadgeVariant(status: TaskStatus): TaskStatusBadgeVariant {
    return TASK_STATUS_BADGE_VARIANT[status]
}

export type TaskStatusBadgeProps = {
    status: TaskStatus
    className?: string
}

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
    const variant = getTaskStatusBadgeVariant(status)

    return (
        <span
            data-slot="task-status-badge"
            data-status={status}
            className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                variant.className,
                className,
            )}
        >
            {variant.label}
        </span>
    )
}
