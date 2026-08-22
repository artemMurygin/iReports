import { ArrowUpRight, Lock } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'

/**
 * Pencil `g6vEv` (empty-state «Месяц ещё не закрыт»): замок в круге, заголовок, подпись
 * «Документы начисления за {месяц} появятся после закрытия месяца — закройте его на
 * странице плана продаж» и secondary-кнопка «Перейти к плану продаж». Переход — колбэк
 * (маршрут знает страница, не фича).
 */
export type AccrualsEmptyStateProps = {
    /** «июль 2026» — подставляется в текст подписи. */
    periodLabel: string
    onGoToSalesPlan: () => void
    className?: string
}

function AccrualsEmptyState({ periodLabel, onGoToSalesPlan, className }: AccrualsEmptyStateProps) {
    return (
        <div
            data-slot="accruals-empty-state"
            className={cn(
                'flex flex-col items-center gap-4 rounded-xl border border-hairline bg-surface px-6 py-20 text-center',
                className,
            )}
        >
            <span className="flex size-16 items-center justify-center rounded-full bg-canvas text-ink-faint">
                <Lock className="size-6" />
            </span>
            <div className="flex flex-col gap-2">
                <p className="font-display text-xl font-bold tracking-[-0.3px] text-ink">Месяц ещё не закрыт</p>
                <p className="max-w-md font-ui text-sm text-ink-muted">
                    Документы начисления за {periodLabel} появятся после закрытия месяца — закройте его на странице
                    плана продаж.
                </p>
            </div>
            <Button type="button" variant="secondary" onClick={onGoToSalesPlan}>
                <ArrowUpRight />
                Перейти к плану продаж
            </Button>
        </div>
    )
}

export { AccrualsEmptyState }
