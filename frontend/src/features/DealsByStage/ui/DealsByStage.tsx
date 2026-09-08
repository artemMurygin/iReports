import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/ui/card'
import { computeFunnel } from '../model/computeStats'
import { type Deal } from '@/kernel/types'

interface Props {
    deals: Deal[]
}

export function DealsByStage({ deals }: Props) {
    const data = useMemo(() => computeFunnel(deals), [deals])
    return (
        <Card className="flex-1 shadow-sm flex flex-col min-h-0">
            <CardHeader className="pb-3 border-b border-gray-100 shrink-0">
                <CardTitle className="text-base font-semibold text-gray-900">Сделки по этапам</CardTitle>
                <CardDescription className="text-sm text-gray-500">Сводка по текущей воронке</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto min-h-0">
                {data.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Нет данных</p>}
                {data.map((item, idx) => {
                    const isLast = idx === data.length - 1
                    const nameColor = item.isSuccess ? '#16a34a' : item.isFail ? '#dc2626' : '#111827'

                    return (
                        <div
                            key={item.stageId}
                            className={[
                                'flex items-center gap-3 px-5 py-3',
                                !isLast ? 'border-b border-gray-100' : '',
                            ].join(' ')}
                        >
                            <div
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                            />
                            <span
                                className="flex-1 text-sm font-medium"
                                style={{
                                    color: nameColor,
                                    fontFamily: 'Inter, sans-serif',
                                }}
                            >
                                {item.name}
                            </span>
                            <span
                                className="text-sm font-bold w-10 text-right"
                                style={{
                                    color: nameColor,
                                    fontFamily: 'Inter, sans-serif',
                                }}
                            >
                                {item.count}
                            </span>
                            <span
                                className="text-sm text-gray-500 w-20 text-right"
                                style={{ fontFamily: 'Inter, sans-serif' }}
                            >
                                {item.revenue.toLocaleString('ru-RU')} ₽
                            </span>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
