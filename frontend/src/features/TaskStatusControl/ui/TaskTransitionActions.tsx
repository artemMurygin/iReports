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
 * Pencil `Q7v9pt`'s `U1bl6` (`Кнопки`) — для `DONE` все три действия перехода рисуются в один ряд
 * равной ширины (не «праймари сверху + два вторичных снизу», как раньше): `На доработку`/
 * `Закрыть неуспешно` — не залитые `violet-soft`/`danger-soft` пилюли, а обведённые белые кнопки
 * (`border-hairline bg-surface`) с цветной иконкой/подписью — тот же приём, что уже даёт
 * `Button.tsx`'s `danger`-вариант. Единый `actions.map(...)` в строку работает и для одиночного
 * действия (`NEW`/`IN_PROGRESS`/`REWORK`) — `flex-1` на единственной кнопке в `flex`-ряду даёт
 * ту же полную ширину, что раньше давал отдельный `w-full`-праймари. Кнопки собраны напрямую
 * (не через `shared/ui-kit/atoms/Button.tsx`) — тот атом не параметризует обводку с цветной
 * иконкой для двух тонов сразу (`НЕ ТРОГАЙ shared/ui-kit`).
 */
const ICON_BY_NAME: Record<TransitionAction['icon'], LucideIcon> = {
    play: Play,
    'check-check': CheckCheck,
    'rotate-ccw': RotateCcw,
    x: X,
}

const TONE_CLASS: Record<TransitionTone, string> = {
    brand: 'bg-brand text-brand-foreground hover:bg-brand-strong',
    violet: 'border border-hairline bg-surface text-violet-ink hover:bg-violet-soft',
    danger: 'border border-hairline bg-surface text-danger hover:bg-danger-soft',
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

    return (
        <div data-slot="task-transition-actions" className={cn('flex flex-col gap-2', className)}>
            {hint && <p className="font-ui text-[11px] leading-snug text-ink-muted">{hint}</p>}
            <div className="flex gap-2">
                {actions.map((action) => (
                    <TransitionButton
                        key={action.targetStatus}
                        action={action}
                        isPending={isPending}
                        onTransition={onTransition}
                        className="flex-1"
                    />
                ))}
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
                'inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-[8px] px-3 font-ui text-xs font-semibold transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-[15px] [&_svg]:shrink-0',
                TONE_CLASS[action.tone],
                className,
            )}
        >
            <Icon />
            {action.label}
        </button>
    )
}
