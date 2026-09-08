import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `PGyPp` (`ERP/Atom/Badge`) — a compact pill
 * (6px radius, 3/8 padding, 6px icon-to-label gap), 11px/600 label. The base definition uses
 * `brand-soft`/`ok-ink` (e.g. an "Утверждён" status pill); this page's own instances reuse the
 * exact same geometry with two different fills as per-instance overrides rather than a new
 * component — `tone` captures that as a variant instead of duplicating the box:
 * - `brand` (default) — `brand-soft`/`ok-ink`, used for a role name pill in
 *   `features/RoleManagement/ui/EmployeeRoleAssignment` (e.g. `iClX5` "Badge Администратор" on
 *   `design/sallary-first-iteration.pen`'s `F6d3a`).
 * - `neutral` — `canvas`/`ink-muted`, used for the "Системная" pill on the `Administrator` role
 *   card (`JUnxq` "System Badge" on `s5nMLx`) that a role card shows instead of
 *   rename/delete icons (`design.md` Decision 9 — a system role cannot be deleted).
 *
 * First-time build of this UI Kit atom from its `uDEum` base — no earlier page instanced it in
 * code yet (frontend/CLAUDE.md: new UI Kit components go in `shared/ui-kit/`, not `shared/ui/`).
 */
const badgeVariants = cva(
    'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
    {
        variants: {
            tone: {
                brand: 'bg-brand-soft text-ok-ink',
                neutral: 'bg-canvas text-ink-muted',
            },
        },
        defaultVariants: {
            tone: 'brand',
        },
    },
)

export type BadgeProps = React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>

function Badge({ tone = 'brand', className, ...props }: BadgeProps) {
    return <span data-slot="badge" data-tone={tone} className={cn(badgeVariants({ tone, className }))} {...props} />
}

export { Badge, badgeVariants }
