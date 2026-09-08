import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `AP9Nr` (`ERP/Atom/Button`),
 * frame "02 Atoms" → "Sec Button · ERP/Atom/Button" for the variant overrides
 * (`Secondary`, `Ghost`, `Danger`, `Disabled`).
 */
const buttonVariants = cva(
    "group/ui-button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-transparent font-ui text-[13px] font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:border-hairline disabled:bg-canvas disabled:text-ink-faint disabled:[&_svg]:text-ink-faint [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px]",
    {
        variants: {
            variant: {
                default: 'bg-brand text-brand-foreground hover:bg-brand-strong',
                secondary: 'border-hairline bg-surface text-ink hover:bg-canvas [&_svg]:text-ink-muted',
                ghost: 'text-ink-muted hover:bg-canvas',
                danger: 'border-hairline bg-surface text-danger hover:bg-danger-soft',
            },
            size: {
                default: 'h-8 gap-1.5 px-[14px]',
                sm: "h-6 gap-1 px-[10px] text-xs [&_svg:not([class*='size-'])]:size-[13px]",
                icon: 'size-8',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
)

function Button({
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean
    }) {
    const Comp = asChild ? Slot.Root : 'button'

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    )
}

export { Button, buttonVariants }
