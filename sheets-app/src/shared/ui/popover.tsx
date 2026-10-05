import * as React from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor

/**
 * Implements FR1 of sheets-app-redesign (Q14): click-opened dark tooltip for the Header help button.
 * Closes on outside click, `Esc` and a repeated click on the trigger (Radix defaults).
 */
function PopoverContent({
    className,
    sideOffset = 6,
    align = 'end',
    children,
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                data-slot="popover-content"
                sideOffset={sideOffset}
                align={align}
                className={cn(
                    'z-50 max-w-[236px] rounded-[10px] bg-foreground px-3 py-2.5 text-left text-xs leading-normal text-background shadow-tooltip outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0',
                    className,
                )}
                {...props}
            >
                {children}
                <PopoverPrimitive.Arrow className="fill-foreground" />
            </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
    )
}

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent }
