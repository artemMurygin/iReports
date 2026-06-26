import type { Deal } from '@/types/deal.ts';
import { CartesianGrid, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card';
import { useState } from 'react';

type Period = "day" | "week" | "month";

type LeadsOverTimeEntry = {
    date: string;
    _originalDate: string;
    [leadSource: string]: number | string;
};

function getDateKey(dateStr: string, period: Period): string {
    const date = new Date(dateStr);
    if (period === "day") {
        return dateStr.slice(5, 10).split("-").reverse().join(".");
    }
    if (period === "month") {
        return `${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
    }
    // неделя: диапазон дат "дд.мм-дд.мм"
    const day = date.getDay()
    const diffToMonday = (day === 0 ? -6 : 1 - day)
    const monday = new Date(date)
    monday.setDate(date.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`
    return `${fmt(monday)}-${fmt(sunday)}`;
}


function transformDealsToLinearChartData(deals: Deal[], period: Period) {
    return deals.reduce((result:LeadsOverTimeEntry[], deal) => {
        const { createdAt, leadSource } = deal

        const date  = getDateKey(createdAt, period)
        const source = leadSource?.name ?? "Не заполнено"

        let entry = result.find(e => e.date === date)
        if (!entry) {
            entry = { date, _originalDate: createdAt }
            result.push(entry)
        }

        entry[source] = ((entry[source] as number) ?? 0) + 1

        return result
    }, [])
    .sort((a, b) => new Date(a._originalDate).getTime() - new Date(b._originalDate).getTime())
}

function getSourcesSortedByCount(deals: Deal[]): string[] {
    const sources = new Set<string>()
    deals.forEach(deal => {
        const source = deal.leadSource?.name ?? "Не заполнено"
        sources.add(source)
    })
    return Array.from(sources)
}

export function DealsOverTimeLinearChart({ deals }: { deals: Deal[] }) {
    const [period, setPeriod] = useState<Period>("week")
    const data = transformDealsToLinearChartData(deals, period);
    const sources = getSourcesSortedByCount(deals);
    const COLORS = [
        "#AAB7BC",
        "#6F7F86",
        "#2F3437",
        "#1F2326",
        "#4CD37A",
        "#38C172",
        "#2DAA5F",
        "#7ED957",
        "#BFAE8E",
        "#8C7B5A",
        "#5A5A5A"
    ];


    return (
        <Card className="flex-1 shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                        <CardTitle className="text-base font-semibold text-gray-900">Лиды во времени</CardTitle>
                        <CardDescription className="text-sm text-gray-500">
                            Динамика по рекламным источникам
                        </CardDescription>
                    </div>
                    <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs shrink-0">
                        {(["day", "week", "month"] as Period[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 transition-colors ${period === p ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                            >
                                {p === "day" ? "День" : p === "week" ? "Неделя" : "Месяц"}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "#9ca3af" }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "#9ca3af" }}
                        />
                        {sources.map((source, i) => (
                            <Line
                                key={source}
                                type="monotone"
                                dataKey={source}
                                stroke={COLORS[i % COLORS.length]}
                                activeDot={{ r: 6 }}
                                strokeWidth={2}
                                dot={false}
                            />
                        ))}
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
                                return (
                                    <div style={{
                                        background: "#fff",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: 8,
                                        padding: "8px 12px",
                                        fontSize: 12
                                    }}>
                                        <p style={{ marginBottom: 6, fontWeight: 600, color: "#374151" }}>{label}</p>
                                        {sorted.map((entry) => {
                                            const key = String(entry.dataKey ?? entry.name ?? '')
                                            return (
                                                <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color ?? 'transparent', display: "inline-block", flexShrink: 0 }} />
                                                    <span style={{ color: "#6b7280" }}>{key}:</span>
                                                    <span style={{ fontWeight: 600, color: "#111827", marginLeft: "auto", paddingLeft: 12 }}>{entry.value}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}