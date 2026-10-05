import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Progress } from '@/shared/ui/progress'

const RING_RADIUS = 22
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

interface ProgressModalProps {
    open: boolean
    title: string
    /** Current stage text (SSE import); the line is omitted when empty. */
    message?: string | null
    /** Omit when cancel is unavailable: the button is hidden and `Esc` does nothing. */
    onCancel?: () => void
}

function Ring() {
    return (
        <svg
            aria-hidden="true"
            data-testid="progress-ring"
            viewBox="0 0 52 52"
            className="size-[38px] shrink-0 -rotate-90 animate-spin"
        >
            <circle cx="26" cy="26" r={RING_RADIUS} fill="none" strokeWidth="6" className="stroke-border" />
            <circle
                cx="26"
                cy="26"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className="stroke-brand"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * 0.75}
            />
        </svg>
    )
}

/**
 * Implements FR9, FR13, UX5 of sheets-app-redesign: modal with Ring, title, status line, indeterminate bar, hint and cancel (no percent or ETA).
 * The optional status line under the title shows the SSE stage text. Focus is trapped by Radix; outside click never closes it; `Esc` equals «Отмена» and works
 * only when `onCancel` is given.
 */
export function ProgressModal({ open, title, message = null, onCancel }: ProgressModalProps) {
    return (
        <Dialog open={open}>
            <DialogContent
                data-testid="progress-modal"
                className="gap-0 overflow-hidden p-0"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => {
                    e.preventDefault()
                    onCancel?.()
                }}
            >
                <div className="flex flex-col gap-3 px-4 pt-4 pb-4">
                    <div className="flex items-center gap-3.5">
                        <Ring />
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <DialogTitle className="text-sm leading-tight font-bold text-foreground">
                                {title}
                            </DialogTitle>
                            {message && (
                                <p
                                    data-testid="progress-message"
                                    className="truncate font-mono text-xs text-muted-foreground"
                                >
                                    {message}
                                </p>
                            )}
                        </div>
                    </div>
                    <Progress aria-label={title} />
                </div>
                <div className="flex items-center justify-between gap-3 bg-muted px-4 py-3">
                    <DialogDescription className="text-xs text-muted-foreground">
                        Не закрывайте таблицу
                    </DialogDescription>
                    {onCancel && (
                        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                            Отмена
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
