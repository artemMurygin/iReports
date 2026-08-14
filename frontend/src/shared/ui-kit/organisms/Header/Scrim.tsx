import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `C19pWf` (`Scrim`, 390x844 rectangle, fill
 * `$scrim` — resolves to `#01030659`, i.e. `ink` at ~35% alpha). A standalone full-viewport
 * dimming backdrop with no content of its own — it exists purely to darken whatever sits behind
 * it (page content, and the mobile header itself) while a menu/drawer is open, and to close that
 * menu on click. The drawer/menu content that would render above it is explicitly out of scope
 * for this rollout phase (see docs/ui-kit-new-header/plan-ui-kit-new-header.md).
 *
 * Always mounted so the opacity change can transition (fade in/out); `pointer-events-none` while
 * closed keeps it from intercepting clicks on the page underneath.
 */
export type ScrimProps = {
    /** Whether the backdrop is visible (a menu/drawer is open). */
    open: boolean
    /** Called when the backdrop is clicked — the caller owns closing the menu/drawer. */
    onClose: () => void
    className?: string
}

function Scrim({ open, onClose, className }: ScrimProps) {
    return (
        <div
            data-slot="scrim"
            aria-hidden={!open}
            onClick={onClose}
            className={cn(
                'fixed inset-0 z-40 bg-scrim transition-opacity duration-200 ease-out',
                open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                className,
            )}
        />
    )
}

export { Scrim }
