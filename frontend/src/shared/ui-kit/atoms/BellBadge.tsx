import * as React from 'react'
import { Bell } from 'lucide-react'

import { cn } from '@/shared/lib/tw'

/**
 * Notification bell icon-button with an unread-indicator dot.
 *
 * Pencil: `design/sallary-first-iteration.pen`, reusable component `wRlAq`
 * (`ERP/Atom/Bell Badge`) — a 32×32 `ERP/Atom/Icon Button` instance (bell icon,
 * `ink-muted`, 15×15) with a `danger`-filled 8×8 unread dot (2px `surface` ring,
 * outer-aligned stroke) pinned to its top-right corner.
 *
 * Built as its own minimal icon-button rather than depending on the `IconButton`
 * atom (not guaranteed to exist yet in this phase) — a later phase can refactor
 * it to compose `IconButton` once that atom lands.
 */
type BellBadgeProps = React.ComponentProps<'button'> & {
    /** Shows/hides the unread-indicator dot. Defaults to `false` (no unread notifications). */
    hasUnread?: boolean
}

function BellBadge({ className, hasUnread = false, ...props }: BellBadgeProps) {
    return (
        <button
            type="button"
            data-slot="bell-badge"
            data-has-unread={hasUnread}
            className={cn(
                'relative inline-flex size-8 shrink-0 items-center justify-center rounded-[6px] text-ink-muted outline-none transition-colors select-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand/30 disabled:pointer-events-none disabled:opacity-50',
                className,
            )}
            {...props}
        >
            <Bell className="size-[15px]" />
            {hasUnread && (
                <span
                    data-slot="bell-badge-dot"
                    className="absolute top-[5px] right-1 size-2 rounded-full bg-danger ring-2 ring-surface"
                />
            )}
        </button>
    )
}

export { BellBadge }
