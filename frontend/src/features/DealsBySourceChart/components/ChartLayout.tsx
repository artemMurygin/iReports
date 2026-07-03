import { Card } from '@/shared/ui/card.tsx'
import type { ReactNode } from 'react'

type Props = {
    children: ReactNode
}

export function ChartLayout(props: Props) {
    const { children } = props
    return <Card className="flex-1 shadow-sm flex flex-col min-h-0">{children}</Card>
}
