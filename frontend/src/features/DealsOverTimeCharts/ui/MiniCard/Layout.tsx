import type { ReactNode } from 'react'

interface LayoutProps {
    children: ReactNode
}

export function Layout({ children }: LayoutProps) {
    return (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 min-w-0">
            {children}
        </div>
    )
}
