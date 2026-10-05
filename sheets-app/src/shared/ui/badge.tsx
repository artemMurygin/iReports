import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/tw'

const badgeVariants = cva(
    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-4 font-semibold whitespace-nowrap',
    {
        variants: {
            variant: {
                default: 'bg-muted text-foreground',
                success: 'bg-brand-soft text-ok-ink',
                danger: 'bg-danger-soft text-danger',
                outline: 'border bg-background text-muted-foreground',
            },
        },
        defaultVariants: { variant: 'default' },
    },
)

/** Implements FR7 of sheets-app-redesign: result Badge («Готово», «С ошибками»). */
function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
    return (
        <span
            data-slot="badge"
            data-variant={variant ?? 'default'}
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    )
}

export { Badge, badgeVariants }
