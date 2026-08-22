import { cn } from '@/shared/lib/tw'

import type { AccrualProgress } from '../model/accrualView.ts'

/**
 * Тонкая полоса «Прогресс начисления» + подпись «N из M» (Pencil `cfNlL`, колонка
 * «Прогресс начисления»; в мобильной карточке `Q0i6z3` — полоса на всю ширину).
 * Цвета из мокапа: полный прогресс — зелёный (`brand-strong`), частичный — жёлтый
 * (`warn`), пустой — только фон `hairline`.
 */
export type AccrualProgressBarProps = {
    progress: AccrualProgress
    /** Скрыть подпись (мобильная карточка рисует её отдельно над полосой). */
    hideLabel?: boolean
    className?: string
}

function AccrualProgressBar({ progress, hideLabel = false, className }: AccrualProgressBarProps) {
    const filledWidth = Math.max(0, Math.min(100, progress.percent))

    return (
        <div data-slot="accrual-progress" className={cn('flex min-w-0 items-center gap-2.5', className)}>
            <div className="h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-hairline">
                <div
                    className={cn('h-full rounded-full', filledWidth >= 100 ? 'bg-brand-strong' : 'bg-warn')}
                    style={{ width: `${filledWidth}%` }}
                />
            </div>
            {!hideLabel && (
                <span className="shrink-0 font-ui text-xs text-ink-muted tabular-nums">{progress.label}</span>
            )}
        </div>
    )
}

export { AccrualProgressBar }
