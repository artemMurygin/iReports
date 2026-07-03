import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { SparklineCell } from './SparklineCell'
import type { ServiceAnalyticsEntry } from '../types'

function fmtMoney(n: number): string {
    if (n >= 1_000_000) {
        const v = n / 1_000_000
        return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} млн ₽`
    }
    return n.toLocaleString('ru-RU') + ' ₽'
}

function profitColor(profit: number): string {
    if (profit > 0) return 'text-emerald-700'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-400'
}

interface Props {
    services: ServiceAnalyticsEntry[]
}

export function ServicesTable({ services }: Props) {
    const sorted = [...services].sort((a, b) => b.totalCount - a.totalCount)
    const maxCount = sorted[0]?.totalCount ?? 1
    const totalCount = sorted.reduce((s, r) => s + r.totalCount, 0)
    const totalRevenue = sorted.reduce((s, r) => s + r.totalRevenue, 0)
    const totalProfit = sorted.reduce((s, r) => s + r.totalProfit, 0)
    const totalBonus = sorted.reduce((s, r) => s + r.totalEngineerBonus, 0)

    if (sorted.length === 0) {
        return (
            <Card className="shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-gray-900">Услуги</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-sm text-gray-400 py-8">
                        Нет данных за выбранный период
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
                <div className="flex items-baseline justify-between gap-4">
                    <div>
                        <CardTitle className="text-xl font-extrabold text-gray-900 tracking-tight">
                            Услуги
                        </CardTitle>
                        <p className="mt-0.5 text-sm text-gray-500">
                            {sorted.length}{' '}
                            {sorted.length === 1
                                ? 'услуга'
                                : sorted.length < 5
                                  ? 'услуги'
                                  : 'услуг'}{' '}
                            · итого {totalCount} продаж
                        </p>
                    </div>
                    <div className="flex items-center gap-6 text-right shrink-0">
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Выручка</p>
                            <p className="text-base font-semibold text-gray-900 tabular-nums">
                                {fmtMoney(totalRevenue)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Прибыль</p>
                            <p
                                className={`text-base font-semibold tabular-nums ${profitColor(totalProfit)}`}
                            >
                                {fmtMoney(totalProfit)}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">
                                Мастерам
                            </p>
                            <p className="text-base font-semibold text-gray-700 tabular-nums">
                                {fmtMoney(totalBonus)}
                            </p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-auto max-h-[920px]">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50 sticky top-0 z-10">
                                <TableHead className="w-8 text-center text-gray-400 font-bold">
                                    #
                                </TableHead>
                                <TableHead className="min-w-[220px] font-bold text-gray-700">
                                    Услуга
                                </TableHead>
                                <TableHead
                                    className="text-right w-24 font-bold text-gray-700"
                                    title="Количество продаж"
                                >
                                    Продажи
                                </TableHead>
                                <TableHead
                                    className="w-32 font-bold text-gray-700"
                                    title="Динамика продаж по периодам"
                                >
                                    Тренд
                                </TableHead>
                                <TableHead
                                    className="text-right w-32 font-bold text-gray-700"
                                    title="Средняя стоимость одной услуги"
                                >
                                    Ср. цена
                                </TableHead>
                                <TableHead
                                    className="text-right w-36 font-bold text-gray-700"
                                    title="Средний чек заказа, содержащего эту услугу"
                                >
                                    Ср. чек заказа
                                </TableHead>
                                <TableHead
                                    className="text-right w-36 font-bold text-gray-700"
                                    title="Суммарная выручка по заказам с услугой"
                                >
                                    Выручка
                                </TableHead>
                                <TableHead
                                    className="text-right w-32 font-bold text-gray-700"
                                    title="Прибыль по заказам с услугой"
                                >
                                    Прибыль
                                </TableHead>
                                <TableHead
                                    className="text-right w-32 font-bold text-gray-700"
                                    title="Начисление мастеру"
                                >
                                    Мастеру
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sorted.map((service, idx) => {
                                const barWidth =
                                    maxCount > 0
                                        ? Math.round((service.totalCount / maxCount) * 100)
                                        : 0
                                return (
                                    <TableRow
                                        key={service.serviceId}
                                        className="group hover:bg-gray-50/80 transition-colors"
                                    >
                                        <TableCell className="text-center text-xs text-gray-300 tabular-nums">
                                            {idx + 1}
                                        </TableCell>
                                        <TableCell className="font-medium text-gray-900 py-3">
                                            <span className="line-clamp-2 leading-snug">
                                                {service.serviceName}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className="tabular-nums font-semibold text-gray-900 text-sm">
                                                    {service.totalCount}
                                                </span>
                                                <div className="w-16 h-1 rounded-full bg-gray-100 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-emerald-400"
                                                        style={{ width: `${barWidth}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <SparklineCell breakdown={service.breakdown} />
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm text-gray-600">
                                            {fmtMoney(service.avgServicePrice)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm text-gray-600">
                                            {fmtMoney(service.avgOrderCheck)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm font-medium text-gray-900">
                                            {fmtMoney(service.totalRevenue)}
                                        </TableCell>
                                        <TableCell
                                            className={`text-right tabular-nums text-sm font-medium ${profitColor(service.totalProfit)}`}
                                        >
                                            {fmtMoney(service.totalProfit)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-sm text-gray-600">
                                            {fmtMoney(service.totalEngineerBonus)}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
