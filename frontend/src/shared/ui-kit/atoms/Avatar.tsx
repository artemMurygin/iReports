import * as React from 'react'
import { Avatar as AvatarPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `i3h5E` (`ERP/Atom/Avatar`) —
 * 32x32 circle, `brand-soft` background, `ok-ink` initials (Roboto 12px/600).
 * Used by the desktop Nav Bar user block (`dRfe8` -> `NoQNT/X8G3zd/WNVaX/CL6Ag`)
 * and the mobile App Bar profile avatar (`kXibe` -> `KMFKi/WBewi`), both of which
 * instantiate the shared base `Avatar/Text` component restyled with these tokens.
 *
 * Mirrors `shared/ui/avatar.tsx`'s structure (radix-ui `Avatar` primitive for
 * image-load/fallback behavior) restyled on the new ui-kit tokens.
 */
function Avatar({
    className,
    size = 'default',
    ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
    size?: 'default' | 'sm' | 'lg'
}) {
    return (
        <AvatarPrimitive.Root
            data-slot="avatar"
            data-size={size}
            className={cn(
                'group/ui-avatar relative flex size-8 shrink-0 rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6',
                className,
            )}
            {...props}
        />
    )
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
    return (
        <AvatarPrimitive.Image
            data-slot="avatar-image"
            className={cn('aspect-square size-full rounded-full object-cover', className)}
            {...props}
        />
    )
}

function AvatarFallback({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
    return (
        <AvatarPrimitive.Fallback
            data-slot="avatar-fallback"
            className={cn(
                "flex size-full items-center justify-center rounded-full bg-brand-soft font-ui text-[12px] font-semibold text-ok-ink group-data-[size=lg]/ui-avatar:text-sm group-data-[size=sm]/ui-avatar:text-[10px] [&_svg]:size-[15px] [&_svg]:text-ok-ink [&_svg:not([class*='size-'])]:size-[15px]",
                className,
            )}
            {...props}
        />
    )
}

export { Avatar, AvatarImage, AvatarFallback }
