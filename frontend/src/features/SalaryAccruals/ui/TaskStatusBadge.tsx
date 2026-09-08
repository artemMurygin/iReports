import { cn } from '@/shared/lib/tw'

import { TASK_STATUS_LABEL, type TaskCompletionStatus } from '../model/labels.ts'

/**
 * tasks.md раздел 23 (add-task-based-salary-rule): бейдж статуса задачи Bitrix24 правила
 * `TaskCompletion` — «Выполнено» / «В работе» / «Просрочено». Без собственного Pencil-фрейма (см.
 * примечание в начале tasks.md) — по прецеденту `AccrualStatusBadge.tsx`/`AdjustLineModal.tsx`:
 * собран из уже существующей геометрии пилюли (та же разметка, что у `AccrualStatusBadge`),
 * собственный `STATUS_CLASS`-record поверх неё, БЕЗ расширения `tone` у
 * `shared/ui-kit/atoms/Badge.tsx` — этот приём уже используется в проекте для доменных
 * статус-бейджей и не требует правки общего атома.
 *
 * Чисто визуальный компонент (пропс `status` → CSS-класс, switch по 3 буквальным строкам уже
 * валидируемого локального типа) — собственного теста не заводится, как и решено в самой задаче
 * 23.1.
 *
 * Цвета переиспользуют уже принятые в файле пары токенов: «Выполнено» — тот же
 * `bg-brand-soft`/`text-ok-ink`, что и у завершённых состояний `AccrualStatusBadge`
 * (`ACCRUED`-строка/`PAID`); «В работе» — тот же `bg-info-soft`/`text-info-ink`, что у
 * «Ожидает выплаты» (`AccrualStatusBadge`, статус `ACCRUED` документа); «Просрочено» — тот же
 * `bg-danger-soft`/`text-danger`, что у `DismissedBadge` («Уволен»).
 */
const STATUS_CLASS: Record<TaskCompletionStatus, string> = {
    DONE: 'bg-brand-soft text-ok-ink',
    IN_PROGRESS: 'bg-info-soft text-info-ink',
    OVERDUE: 'bg-danger-soft text-danger',
}

export type TaskStatusBadgeProps = {
    status: TaskCompletionStatus
    className?: string
}

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
    return (
        <span
            data-slot="task-status-badge"
            data-status={status}
            className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                STATUS_CLASS[status],
                className,
            )}
        >
            {TASK_STATUS_LABEL[status]}
        </span>
    )
}
