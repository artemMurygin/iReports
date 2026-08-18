import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node inside `tSYIw` → `Field Отдел`/`Field Роль`/
 * `Field Тип` → `Control` — the same 36px `surface`/`hairline`/8px-radius box as `atoms/Input.tsx`
 * (they're meant to sit flush in the same form), with a trailing 15px `chevron-down` (`ink-muted`)
 * instead of free text, and 13px/500 `ink` value text (`ink-faint` while showing the placeholder).
 *
 * Built on `radix-ui`'s `Select` primitive (already used by the pre-existing `shared/ui/select.tsx`
 * shadcn primitive this restyles for the new token set — see that file for the source pattern of
 * compound exports) rather than a native `<select>`, for the same reason `Checkbox` is
 * `radix-ui`-based: correct listbox semantics/keyboard behavior for free. Only the subset of
 * sub-parts the salary schema form needs (`Select`, `SelectValue`, `SelectTrigger`,
 * `SelectContent`, `SelectItem`) — no groups/labels/separators, unlike the shadcn version — add
 * them here if a later phase needs them rather than reaching back into `shared/ui/select.tsx`.
 */
function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
    return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
    return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
    className,
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
    return (
        <SelectPrimitive.Trigger
            data-slot="select-trigger"
            className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-[8px] border border-hairline bg-surface px-3 font-ui text-[13px] font-medium text-ink outline-none transition-colors data-[placeholder]:font-normal data-[placeholder]:text-ink-faint focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-faint [&>span]:line-clamp-1 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                className,
            )}
            {...props}
        >
            {children}
            <SelectPrimitive.Icon asChild>
                <ChevronDown className="size-[15px] shrink-0 text-ink-muted" />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    )
}

function SelectContent({
    className,
    children,
    position = 'popper',
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                data-slot="select-content"
                position={position}
                className={cn(
                    'relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-[10px] border border-hairline bg-surface shadow-lg',
                    position === 'popper' &&
                        'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
                    className,
                )}
                {...props}
            >
                <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
    return (
        <SelectPrimitive.Item
            data-slot="select-item"
            className={cn(
                'relative flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-[7px] font-ui text-[13px] font-medium text-ink outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-canvas',
                className,
            )}
            {...props}
        >
            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="ml-auto flex items-center">
                <Check className="size-[13px] text-brand-strong" />
            </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
    )
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
