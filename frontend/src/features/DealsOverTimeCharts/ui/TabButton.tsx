import type { ReactNode } from 'react'

interface TabButtonProps {
    active: boolean
    onClick: () => void
    children: ReactNode
}

export function TabButton({ active, onClick, children }: TabButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
        >
            {children}
        </button>
    )
}
