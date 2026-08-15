import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

export type ModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: React.ReactNode
    subtitle?: React.ReactNode
    children: React.ReactNode
    footer?: React.ReactNode
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `XttYX` (`ERP/Organism/Modal`) — the only
 * reusable modal component in the .pen file (the shadcn `zGCAR`/`Dialog` and `SEszC`/
 * `Modal/Center` components use the old `--card`/`--primary` token set and were not picked as
 * the base, since `frontend/CLAUDE.md` directs all new components onto the new UI Kit token
 * namespace, which `XttYX` already uses: `Header` (Title + muted Subtitle, a trailing `Close`
 * icon button) / `Body` (a generic content slot — the caller's `children`) / `Footer`
 * (`canvas`-filled, a left-aligned hint plus right-aligned actions — the caller's `footer`).
 * There is no instance of `XttYX` anywhere else in the document; this is a first-time build of
 * the component from its base definition.
 *
 * Built on `radix-ui`'s `Dialog` primitive (same package already used for `Checkbox`/
 * `Popover`, see `atoms/Checkbox.tsx`), which gets overlay-click and Escape-to-close, focus
 * trapping, and `aria-*` wiring for free — a `shared/ui-kit` organism has no business logic of
 * its own, callers own what's inside `children`/`footer` and whether the dialog is `open`.
 */
function Modal({ open, onOpenChange, title, subtitle, children, footer, className }: ModalProps) {
    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    data-slot="modal-overlay"
                    className="fixed inset-0 z-50 bg-scrim data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
                />
                <DialogPrimitive.Content
                    data-slot="modal-content"
                    className={cn(
                        'fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
                        className,
                    )}
                >
                    <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                            <DialogPrimitive.Title className="font-display text-base font-bold text-ink">
                                {title}
                            </DialogPrimitive.Title>
                            {subtitle && (
                                <DialogPrimitive.Description className="font-ui text-xs text-ink-muted">
                                    {subtitle}
                                </DialogPrimitive.Description>
                            )}
                        </div>
                        <DialogPrimitive.Close asChild>
                            <IconButton aria-label="Закрыть" className="shrink-0">
                                <X />
                            </IconButton>
                        </DialogPrimitive.Close>
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

                    {footer && <div className="shrink-0 border-t border-hairline bg-canvas px-5 py-3.5">{footer}</div>}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    )
}

export { Modal }
