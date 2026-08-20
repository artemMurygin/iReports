import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { BottomNav } from '@/app/BottomNav.tsx'
import { Header } from '@/app/Header.tsx'

export function Layout() {
    // The mobile drawer (opened by the Header's hamburger, Pencil node `kXibe`) also needs to
    // open from `BottomNav`'s "Ещё" item (Pencil node `XXiyY`) — the two live in separate
    // components that are siblings here, so their shared open/closed state is lifted to this
    // common ancestor and handed to both as controlled `open`/`onOpenChange` props, rather than
    // each owning its own (which would let the drawer be "open" from one trigger's view and
    // "closed" from the other's).
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // `BottomNav` is `position: sticky` scoped to this whole layout (its containing block is this
    // outer div, not just the space below `<Outlet/>`), so it stays pinned to the viewport bottom
    // for virtually the entire scroll range of every page — not just once a page has scrolled to
    // its very end. Any page-level mobile sticky bar rendered inside `<Outlet/>` (e.g.
    // `pages/SalaryRules`' and `pages/SalaryRuleDetail`'s `MobileSaveBar`) that also sticks to
    // `bottom-0` therefore renders in the exact same spot as `BottomNav` — fully overlapped and,
    // being underneath in DOM/z-order or not, unreachable to taps either way. `BottomNav`'s
    // rendered height varies with `env(safe-area-inset-bottom)`, so it can't be hardcoded; this
    // measures the real `<nav>` box (via the ref `BottomNav` forwards) and republishes it as the
    // `--bottom-nav-h` CSS variable on this common ancestor, so any descendant sticky bar can
    // offset itself with `bottom-[var(--bottom-nav-h,4.5rem)]` instead of `bottom-0` and stack
    // above `BottomNav` instead of underneath/behind it.
    const bottomNavRef = useRef<HTMLElement>(null)
    const [bottomNavHeight, setBottomNavHeight] = useState(0)

    useLayoutEffect(() => {
        const el = bottomNavRef.current
        if (!el) return

        const updateHeight = () => setBottomNavHeight(el.getBoundingClientRect().height)
        updateHeight()

        const observer = new ResizeObserver(updateHeight)
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div
            className="flex flex-col min-h-screen bg-gray-50"
            style={{ fontFamily: 'Inter, sans-serif', '--bottom-nav-h': `${bottomNavHeight}px` } as CSSProperties}
        >
            <Header open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
            <Outlet />
            <BottomNav ref={bottomNavRef} open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
            <Toaster
                position="bottom-right"
                richColors
                toastOptions={{
                    classNames: {
                        toast: 'text-sm font-medium shadow-2xl border border-gray-200 rounded-2xl px-4 py-3 min-w-[220px]',
                        loader: 'text-gray-500',
                    },
                }}
            />
        </div>
    )
}
