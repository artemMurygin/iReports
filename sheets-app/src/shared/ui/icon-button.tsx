import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/tw'

const iconButtonVariants = cva(
    "inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            size: { default: 'size-7', sm: 'size-6', lg: 'size-8' },
        },
        defaultVariants: { size: 'default' },
    },
)

type IconButtonProps = Omit<React.ComponentProps<'button'>, 'aria-label'> &
    VariantProps<typeof iconButtonVariants> & { 'aria-label': string }

/** Implements FR1, FR6, UX6 of sheets-app-redesign: icon-only button; `aria-label` is required by the type. */
function IconButton({ className, size, type = 'button', ...props }: IconButtonProps) {
    return (
        <button
            data-slot="icon-button"
            type={type}
            className={cn(iconButtonVariants({ size }), className)}
            {...props}
        />
    )
}

export { IconButton, iconButtonVariants }
