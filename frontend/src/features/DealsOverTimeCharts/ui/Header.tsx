import type { ReactNode } from 'react'
import { CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'

interface HeaderProps {
    title: string
    description: string
    tabsActions: ReactNode
}

export function Header({ title, description, tabsActions }: HeaderProps) {
    return (
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
            <div>
                <CardTitle className="text-base font-semibold text-card-foreground">
                    {title}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                    {description}
                </CardDescription>
            </div>
            <div className="flex items-center rounded-md border border-border bg-muted p-0.5 shrink-0">
                {tabsActions}
            </div>
        </CardHeader>
    )
}
