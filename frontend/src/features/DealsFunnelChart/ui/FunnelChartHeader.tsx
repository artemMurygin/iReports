import { CardDescription, CardHeader, CardTitle } from '@/shared/ui/card.tsx'

type Props = {
    title: string
    description: string
}

export function FunnelChartHeader({
 title, description 
}: Props) {
    return (
        <CardHeader className="pb-2 shrink-0">
            <div className="flex flex-col gap-1">
                <CardTitle className="text-base font-semibold text-gray-900">{title}</CardTitle>
                <CardDescription className="text-sm text-gray-500">{description}</CardDescription>
            </div>
        </CardHeader>
    )
}
