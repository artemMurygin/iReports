import { type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

interface TableLayoutProps {
    total: number
    header?: ReactNode
    body?: ReactNode
    footer?: ReactNode
}

export function TableLayout({ total, header, body, footer }: TableLayoutProps) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <CardTitle className="text-base font-semibold text-gray-900">Все сделки</CardTitle>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        {total} сделок
                    </span>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="border border-gray-200 rounded-lg overflow-hidden mx-5">
                    {header}
                    {body}
                </div>
                {footer}
            </CardContent>
        </Card>
    )
}