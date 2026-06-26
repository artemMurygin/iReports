import { Outlet } from 'react-router-dom';
import { Header } from '@/app/Header.tsx';

export function Layout() {
    return (
        <div className="flex flex-col min-h-screen bg-gray-50" style={{ fontFamily: "Inter, sans-serif" }}>
            <Header />
            <Outlet />
        </div>
    )
}