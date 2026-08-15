import { useState } from 'react'
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

    return (
        <div className="flex flex-col min-h-screen bg-gray-50" style={{ fontFamily: 'Inter, sans-serif' }}>
            <Header open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
            <Outlet />
            <BottomNav open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
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
