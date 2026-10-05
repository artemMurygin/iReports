import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Implements FR9 of sheets-app-redesign: progress bar. A numeric `value` renders a determinate bar;
 * `value` null/undefined renders the indeterminate bar for blocking calls (no percent, no ETA).
 */
function Progress({
    className,
    value,
    ...props
}: Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, 'value'> & { value?: number | null }) {
    const determinate = typeof value === 'number'
    const pct = determinate ? Math.min(100, Math.max(0, value)) : 0
    return (
        <ProgressPrimitive.Root
            data-slot="progress"
            data-indeterminate={determinate ? undefined : ''}
            value={determinate ? pct : null}
            className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
            {...props}
        >
            <ProgressPrimitive.Indicator
                data-slot="progress-indicator"
                className={cn(
                    'h-full rounded-full bg-brand transition-[width]',
                    !determinate && 'w-2/5 animate-[progress-indeterminate_1.2s_ease-in-out_infinite]',
                )}
                style={determinate ? { width: `${pct}%` } : undefined}
            />
        </ProgressPrimitive.Root>
    )
}

export { Progress }
