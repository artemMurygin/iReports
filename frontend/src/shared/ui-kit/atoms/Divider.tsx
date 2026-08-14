import * as React from 'react'
import { Separator as SeparatorPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `NoQNT` (`ERP/Organism/Topnav` → `Nav Bar`),
 * dividers `T0p7tl` (between Brand and Sections inside `Nav Left`) and `f4tNY` (between Bell and
 * User inside `Nav Right`) — 1px hairline-colored rectangles, 22px long, centered in the 56px bar.
 *
 * A purely visual separator (no semantic meaning), so it stays `decorative` by default. Both known
 * usages are vertical dividers inside a horizontal nav bar, hence the `vertical` default orientation.
 */
function Divider({
    className,
    orientation = 'vertical',
    decorative = true,
    ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
    return (
        <SeparatorPrimitive.Root
            data-slot="divider"
            decorative={decorative}
            orientation={orientation}
            className={cn(
                'shrink-0 bg-hairline data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-[22px] data-[orientation=vertical]:w-px',
                className,
            )}
            {...props}
        />
    )
}

export { Divider }
