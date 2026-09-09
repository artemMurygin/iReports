import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

export type SidePanelProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Visible header (title + close button), same chrome as `Modal`'s header — omit when the
     * content already renders its own title/close (e.g. `TaskStatusCard`), and supply `srOnlyTitle`
     * instead so Radix still gets the accessible name it requires. */
    title?: React.ReactNode
    /** Accessible name for Radix's `Dialog.Title` when `title` is omitted (rendered `sr-only`). */
    srOnlyTitle?: string
    children: React.ReactNode
    footer?: React.ReactNode
    className?: string
}

/**
 * Right-side panel on desktop (460px), bottom sheet on mobile — extracted out of
 * `pages/Tasks/ui/TaskDrawer.tsx` into `shared/ui-kit` once a second caller
 * (`features/SalaryRuleForm`'s task-linking flow, via `features/CreateTask`'s `CreateTaskPanel` and
 * `features/TaskStatusControl`'s `TaskDetailsPanel`) needed the exact same chrome — a
 * `shared/ui-kit` organism has no business logic of its own (mirrors `Modal.tsx`'s own WHY),
 * callers own what's inside `children`/`footer` and whether the panel is `open`.
 *
 * The mobile bottom-sheet classes (`slide-in-from-bottom`/`slide-out-to-bottom`, unprefixed) stay
 * active at `md:` too — Tailwind responsive prefixes don't remove base utilities, and
 * `tw-animate-css`'s enter/exit keyframe combines `--tw-enter-translate-x`/`-y` into a single
 * `translate3d(...)`. Without the `md:...-bottom-0` resets below, the desktop panel would slide in
 * diagonally ("from the corner") instead of strictly from the right.
 */
function SidePanel({ open, onOpenChange, title, srOnlyTitle, children, footer, className }: SidePanelProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    data-slot="side-panel-overlay"
                    className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
                />
                <DialogPrimitive.Content
                    data-slot="side-panel-content"
                    className={cn(
                        'fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-y-auto rounded-t-2xl border-t border-hairline bg-surface shadow-2xl outline-none',
                        'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
                        'md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:h-full md:max-h-none md:w-[460px] md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l',
                        'md:data-[state=open]:slide-in-from-right md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=closed]:slide-out-to-right md:data-[state=closed]:slide-out-to-bottom-0',
                        className,
                    )}
                >
                    {title ? (
                        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-4">
                            <DialogPrimitive.Title className="font-display text-base font-bold text-ink">
                                {title}
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Close asChild>
                                <IconButton aria-label="Закрыть" className="shrink-0">
                                    <X />
                                </IconButton>
                            </DialogPrimitive.Close>
                        </div>
                    ) : (
                        <DialogPrimitive.Title className="sr-only">{srOnlyTitle}</DialogPrimitive.Title>
                    )}

                    <div className="flex-1 overflow-y-auto">{children}</div>

                    {footer && <div className="shrink-0 border-t border-hairline bg-canvas px-5 py-3.5">{footer}</div>}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}

export { SidePanel }
