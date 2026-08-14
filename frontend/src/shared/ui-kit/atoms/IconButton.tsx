import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `qVdml` (`ERP/Atom/Icon Button`),
 * frame "02 Atoms" → "Sec Icon Button · Checkbox · Progress · Avatar" (`U9Sqh`) for the
 * variant overrides (`IB Hover`, `IB Danger`, `IB Active`), and `kXibe` (`ERP/Mobile/App Bar`)
 * for the `lg` size used by the hamburger (`JqYQG`) and the two right-side action buttons
 * (`tbU0H`, `oTq9M`).
 *
 * The icon itself is passed as `children` (e.g. a `lucide-react` icon) — same convention as
 * `Button.tsx`. Its color is inherited via `currentColor` from the button's `text-*` class, and
 * its default size (15px) can be overridden per-instance with an explicit `size-*` class, again
 * mirroring `Button.tsx`.
 */
const iconButtonVariants = cva(
    "group/icon-button inline-flex shrink-0 items-center justify-center rounded-[6px] border border-transparent transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:text-ink-faint disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px]",
    {
        variants: {
            variant: {
                default: 'text-ink-muted hover:bg-canvas',
                danger: 'text-ink-faint hover:bg-danger-soft hover:text-danger',
            },
            size: {
                default: 'size-7',
                lg: 'size-8',
            },
            active: {
                true: 'bg-brand-soft text-ok-ink hover:bg-brand-soft',
                false: '',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
            active: false,
        },
    },
)

function IconButton({
    className,
    variant = 'default',
    size = 'default',
    active = false,
    asChild = false,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof iconButtonVariants> & {
        asChild?: boolean
    }) {
    const Comp = asChild ? Slot.Root : 'button'

    return (
        <Comp
            data-slot="icon-button"
            data-variant={variant}
            data-size={size}
            data-active={active || undefined}
            className={cn(iconButtonVariants({ variant, size, active, className }))}
            {...props}
        />
    )
}

export { IconButton, iconButtonVariants }
