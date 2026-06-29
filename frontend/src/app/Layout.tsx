import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Header } from '@/app/Header.tsx';

export function Layout() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
            <Header />
            <Outlet />
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