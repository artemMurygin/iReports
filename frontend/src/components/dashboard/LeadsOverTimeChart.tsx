import { useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { type TimeSeriesPoint, type SourceLine, type GroupBy } from "@/lib/computeStats"

const tabs: { key: GroupBy; label: string }[] = [
  { key: "day",   label: "День" },
  { key: "week",  label: "Неделя" },
  { key: "month", label: "Месяц" },
]

interface Props {
  dataByTab: Record<GroupBy, TimeSeriesPoint[]>
  sources: SourceLine[]
  onTabChange: (tab: GroupBy) => void
  activeTab: GroupBy
}

export function LeadsOverTimeChart({ dataByTab, sources, onTabChange, activeTab }: Props) {
  const data = dataByTab[activeTab]

  return (
        <Card className="flex-1 shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                        <CardTitle className="text-base font-semibold text-gray-900">Лиды во времени</CardTitle>
                        <CardDescription className="text-sm text-gray-500">
                            Динамика по рекламным источникам
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1 h-9">
                        {tabs.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => onTabChange(tab.key)}
                                className={[
                                    "px-3 py-1 rounded text-sm font-medium transition-all",
                                    activeTab === tab.key
                                    ? "bg-white shadow-sm text-gray-900"
                                    : "text-gray-500 hover:text-gray-700",
                                    ].join(" ")}
                                    style={{ fontFamily: "Inter, sans-serif" }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
                {data.length === 0 ? (
                    <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
                    Нет данных
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fill: "#9ca3af", fontFamily: "Inter, sans-serif" }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fill: "#9ca3af", fontFamily: "Inter, sans-serif" }}
                            />
                            {sources.map((source) => (
                                <Line
                                    key={source.id}
                                    type="monotone"
                                    dataKey={source.id}
                                    stroke={source.color}
                                    strokeWidth={3.5}
                                    dot={false}
                                    activeDot={{ r: 6 }}
                                />
                            ))}
                            <Legend
                                iconType="circle"
                                iconSize={10}
                                wrapperStyle={{ fontSize: 12, fontFamily: "Inter, sans-serif" }}
                                formatter={(value) =>
                                    sources.find((s) => s.id === value)?.name ?? value}
                            />

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
                                            fontSize: 12,
                                            fontFamily: "Inter, sans-serif",
                                        }}>
                                            <p style={{ marginBottom: 6, fontWeight: 600, color: "#374151" }}>{label}</p>
                                            {sorted.map((entry) => (
                                                <div key={entry.dataKey as string} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, display: "inline-block", flexShrink: 0 }} />
                                                    <span style={{ color: "#6b7280" }}>{sources.find((s) => s.id === entry.dataKey)?.name ?? entry.dataKey}:</span>
                                                    <span style={{ fontWeight: 600, color: "#111827", marginLeft: "auto", paddingLeft: 12 }}>{entry.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}