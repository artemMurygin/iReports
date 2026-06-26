import { Card } from '@/shared/ui/card.tsx';
import type { ReactNode } from 'react';

type Props = {
    children: ReactNode
}

export function FunnelChartLayout({ children }: Props) {
    return (
        <Card className="flex-1 shadow-sm flex flex-col min-h-0 max-h-[500px] overflow-auto">
            {children}
        </Card>
    )
}
