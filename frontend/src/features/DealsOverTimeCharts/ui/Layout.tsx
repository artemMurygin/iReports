import { type ReactNode } from 'react'
import { Card, CardContent } from '@/shared/ui/card'

interface LayoutProps {
    header?: ReactNode
    body?: ReactNode
}

export function Layout({ header, body }: LayoutProps) {
    return (
        <Card className="flex-1 shadow-sm">
            {header}
            <CardContent className="pt-2 pb-4">{body}</CardContent>
        </Card>
    )
}
