import { CircleX, TriangleAlert, X } from 'lucide-react'
import { IconButton } from '@/shared/ui/icon-button'
import { cn } from '@/shared/lib/tw'

export type StatusBannerVariant = 'error' | 'warning'

interface StatusBannerProps {
    variant?: StatusBannerVariant
    title: string
    detail?: string
    onClose?: () => void
    className?: string
    'data-testid'?: string
}

/**
 * Implements FR6, UX6 of sheets-app-redesign: error (and warning, Q12) banner with title, detail and a
 * close button. Closing the banner does not touch the card's own error status. Announced politely.
 */
export function StatusBanner({
    variant = 'error',
    title,
    detail,
    onClose,
    className,
    'data-testid': testId,
}: StatusBannerProps) {
    const Icon = variant === 'error' ? CircleX : TriangleAlert
    return (
        <div
            role="status"
            aria-live="polite"
            data-testid={testId}
            data-variant={variant}
            className={cn(
                'flex items-start gap-2.5 rounded-xl border px-3.5 py-3',
                variant === 'error'
                    ? 'border-danger-border bg-danger-soft text-danger'
                    : 'border-tile-copper-bg bg-tile-copper-bg/50 text-tile-copper-ink',
                className,
            )}
        >
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-tight font-semibold">{title}</p>
                {detail && <p className="mt-1 font-mono text-xs leading-snug break-words">{detail}</p>}
            </div>
            {onClose && (
                <IconButton
                    aria-label="Закрыть"
                    size="sm"
                    onClick={onClose}
                    className="text-current hover:bg-transparent hover:text-current"
                >
                    <X />
                </IconButton>
            )}
        </div>
    )
}
