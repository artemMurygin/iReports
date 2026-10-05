import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, CircleCheck, CircleX, Circle, Play, RefreshCw, Wrench } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/tw'
import { InfoDot, type FuncTooltipContent } from './FuncTooltip'

export type FuncTile = 'brand' | 'copper' | 'info'

/** Per-function status (FR4). Statuses are independent between cards. */
export type FuncCardStatus =
    | { state: 'idle' }
    | { state: 'success'; time: string; count?: number }
    | { state: 'error'; time: string; errorCode?: string | number }

const TILE: Record<FuncTile, { box: string; Icon: typeof ArrowUp }> = {
    brand: { box: 'bg-brand-soft text-ok-ink', Icon: ArrowUp },
    copper: { box: 'bg-tile-copper-bg text-tile-copper-ink', Icon: Wrench },
    info: { box: 'bg-tile-info-bg text-tile-info-ink', Icon: ArrowDown },
}

interface FuncCardProps {
    title: string
    description: string
    tile: FuncTile
    status: FuncCardStatus
    tooltip: FuncTooltipContent
    onRun?: () => void
    onRetry?: () => void
    disabled?: boolean
    'data-testid'?: string
    children?: ReactNode
}

function statusText(status: FuncCardStatus): string {
    if (status.state === 'idle') return 'ещё не запускалось'
    if (status.state === 'success') {
        return status.count === undefined ? status.time : `${status.time} · ${status.count}`
    }
    return status.errorCode === undefined ? status.time : `${status.time} · ошибка ${status.errorCode}`
}

/**
 * Implements FR3, FR4, FR5, UX4, UX6 of sheets-app-redesign: function card with tile, title, description,
 * Info Dot and a footer showing idle / success / error status plus Run / Retry. The status text is
 * truncated with an ellipsis so it never pushes the button out (UX4).
 */
export function FuncCard({
    title,
    description,
    tile,
    status,
    tooltip,
    onRun,
    onRetry,
    disabled = false,
    'data-testid': testId,
}: FuncCardProps) {
    const { box, Icon } = TILE[tile]
    const StatusIcon = status.state === 'success' ? CircleCheck : status.state === 'error' ? CircleX : Circle
    const handler = status.state === 'idle' ? onRun : onRetry

    return (
        <section
            data-testid={testId}
            data-status={status.state}
            aria-label={title}
            className={cn(
                'rounded-xl border bg-card shadow-xs',
                status.state === 'error' && 'border-border',
                disabled && 'opacity-50',
            )}
        >
            <div className="flex items-start gap-3 p-3 pb-3">
                <span
                    data-testid="func-tile"
                    data-tile={tile}
                    aria-hidden="true"
                    className={cn('flex size-[30px] shrink-0 items-center justify-center rounded-[9px]', box)}
                >
                    <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3 className="text-[13px] leading-tight font-semibold text-foreground">{title}</h3>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
                </div>
                <InfoDot content={tooltip} />
            </div>
            <div className="mx-3 border-t" />
            <div className="flex items-center gap-2 px-3 py-2.5">
                <span
                    data-testid="func-status"
                    aria-live="polite"
                    className={cn(
                        'flex min-w-0 flex-1 items-center gap-1.5 font-mono text-[10px]',
                        status.state === 'idle' && 'text-ink-faint',
                        status.state === 'success' && 'text-ok-ink',
                        status.state === 'error' && 'text-danger',
                    )}
                >
                    <StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />
                    <span className="truncate">{statusText(status)}</span>
                </span>
                <Button
                    type="button"
                    size="run"
                    variant={status.state === 'error' ? 'destructive-outline' : 'outline'}
                    disabled={disabled}
                    onClick={handler}
                    className="shrink-0"
                >
                    {status.state === 'idle' ? <Play /> : <RefreshCw />}
                    {status.state === 'idle' ? 'Запустить' : 'Повторить'}
                </Button>
            </div>
        </section>
    )
}
