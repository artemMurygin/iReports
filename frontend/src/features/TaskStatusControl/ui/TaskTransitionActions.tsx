import { CheckCheck, Play, RotateCcw, X, type LucideIcon } from 'lucide-react'
import type { TaskStatus } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import {
    getTransitionActions,
    getTransitionHint,
    type TransitionAction,
    type TransitionTone,
} from '../model/transitionActions.ts'

/**
 * Pencil: `l1j1ik`/`Блок · Действия` (kf1uq — один праймари-экшен), `LTz4i` (QpFcx — праймари-экшен
 * + строка из двух вторичных). Кнопки собраны напрямую (не через `shared/ui-kit/atoms/Button.tsx`)
 * — тот атом не параметризует `violet-soft`/`danger-soft`-заливки «На доработку»/«Закрыть
 * неуспешно», а расширять его этой задаче не входит в её область (`НЕ ТРОГАЙ shared/ui-kit`).
 * `CLOSED_SUCCESSFULLY`/`CLOSED_UNSUCCESSFULLY` (`getTransitionActions` -> `[]`) рендерят `null` —
 * `TaskStatusCard` в этом случае показывает отдельную пометку результата вместо этого блока.
 */
const ICON_BY_NAME: Record<TransitionAction['icon'], LucideIcon> = {
    play: Play,
    'check-check': CheckCheck,
    'rotate-ccw': RotateCcw,
    x: X,
}

const TONE_CLASS: Record<TransitionTone, string> = {
    brand: 'bg-brand text-brand-foreground hover:bg-brand-strong',
    violet: 'bg-violet-soft text-violet-ink hover:brightness-95',
    danger: 'bg-danger-soft text-danger hover:brightness-95',
}

export type TaskTransitionActionsProps = {
    status: TaskStatus
    onTransition: (targetStatus: TaskStatus) => void
    isPending?: boolean
    className?: string
}

export function TaskTransitionActions({
    status,
    onTransition,
    isPending = false,
    className,
}: TaskTransitionActionsProps) {
    const actions = getTransitionActions(status)
    if (actions.length === 0) return null

    const hint = getTransitionHint(status)
    const [primary, ...secondary] = actions

    return (
        <div data-slot="task-transition-actions" className={cn('flex flex-col gap-3', className)}>
            {hint && <p className="font-ui text-xs leading-snug text-ink-muted">{hint}</p>}
            <div className="flex flex-col gap-2">
                <TransitionButton action={primary} isPending={isPending} onTransition={onTransition} />
                {secondary.length > 0 && (
                    <div className="flex gap-2">
                        {secondary.map((action) => (
                            <TransitionButton
                                key={action.targetStatus}
                                action={action}
                                isPending={isPending}
                                onTransition={onTransition}
                                className="flex-1"
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function TransitionButton({
    action,
    isPending,
    onTransition,
    className,
}: {
    action: TransitionAction
    isPending: boolean
    onTransition: (targetStatus: TaskStatus) => void
    className?: string
}) {
    const Icon = ICON_BY_NAME[action.icon]
    return (
        <button
            type="button"
            disabled={isPending}
            onClick={() => onTransition(action.targetStatus)}
            className={cn(
                'inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] px-4 font-ui text-[13px] font-medium transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-[15px] [&_svg]:shrink-0',
                TONE_CLASS[action.tone],
                className,
            )}
        >
            <Icon />
            {action.label}
        </button>
    )
}
