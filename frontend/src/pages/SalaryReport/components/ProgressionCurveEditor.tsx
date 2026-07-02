import { Plus, Trash2 } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/shared/ui/button'
import type { ProgressionMode, ProgressionTier } from '../types'
import { progressionCoef } from '../utils/progressionCoef'

interface Props {
    tiers: ProgressionTier[]
    onChange: (tiers: ProgressionTier[]) => void
}

const MODES: ProgressionMode[] = ['FIXED', 'LINEAR', 'MULTIPLIER']

function buildCurvePoints(tiers: ProgressionTier[]) {
    if (tiers.length === 0) return []
    const maxPct = Math.max(150, ...tiers.map((t) => t.toPct ?? t.fromPct + 30))
    const points: { pct: number; coef: number }[] = []
    for (let pct = 0; pct <= maxPct; pct += Math.max(1, Math.round(maxPct / 60))) {
        points.push({ pct, coef: progressionCoef(pct, tiers) })
    }
    return points
}

export function ProgressionCurveEditor({ tiers, onChange }: Props) {
    const points = buildCurvePoints(tiers)

    function updateTier(index: number, patch: Partial<ProgressionTier>) {
        onChange(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)))
    }

    function removeTier(index: number) {
        onChange(tiers.filter((_, i) => i !== index))
    }

    function addTier() {
        const last = tiers[tiers.length - 1]
        const fromPct = last ? (last.toPct ?? last.fromPct + 30) : 0
        onChange([
            ...tiers,
            { fromPct, toPct: null, mode: 'FIXED', coef: 1, coefFrom: null, coefTo: null },
        ])
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="pct"
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 11 }}
                            stroke="#9ca3af"
                        />
                        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                        <Tooltip
                            formatter={(value) => [Number(value).toFixed(2), 'коэффициент']}
                            labelFormatter={(v) => `${v}% плана`}
                        />
                        <Line
                            type="monotone"
                            dataKey="coef"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="flex flex-col gap-2">
                {tiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-400 w-4">{i + 1}</span>
                        <input
                            type="number"
                            value={tier.fromPct}
                            onChange={(e) => updateTier(i, { fromPct: Number(e.target.value) })}
                            className="w-16 h-8 px-2 rounded border border-gray-200 tabular-nums"
                        />
                        <span className="text-gray-400">–</span>
                        <input
                            type="number"
                            value={tier.toPct ?? ''}
                            placeholder="∞"
                            onChange={(e) =>
                                updateTier(i, {
                                    toPct: e.target.value === '' ? null : Number(e.target.value),
                                })
                            }
                            className="w-16 h-8 px-2 rounded border border-gray-200 tabular-nums"
                        />
                        <span className="text-gray-400">%</span>

                        <select
                            value={tier.mode}
                            onChange={(e) => updateTier(i, { mode: e.target.value as ProgressionMode })}
                            className="h-8 px-2 rounded border border-gray-200"
                        >
                            {MODES.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>

                        {tier.mode === 'LINEAR' ? (
                            <>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={tier.coefFrom ?? ''}
                                    placeholder="coefFrom"
                                    onChange={(e) => updateTier(i, { coefFrom: Number(e.target.value) })}
                                    className="w-20 h-8 px-2 rounded border border-gray-200 tabular-nums"
                                />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={tier.coefTo ?? ''}
                                    placeholder="coefTo"
                                    onChange={(e) => updateTier(i, { coefTo: Number(e.target.value) })}
                                    className="w-20 h-8 px-2 rounded border border-gray-200 tabular-nums"
                                />
                            </>
                        ) : (
                            <input
                                type="number"
                                step="0.01"
                                value={tier.coef ?? ''}
                                placeholder="coef"
                                onChange={(e) => updateTier(i, { coef: Number(e.target.value) })}
                                className="w-20 h-8 px-2 rounded border border-gray-200 tabular-nums"
                            />
                        )}

                        <Button variant="ghost" size="icon-sm" onClick={() => removeTier(i)}>
                            <Trash2 className="size-3.5 text-gray-400" />
                        </Button>
                    </div>
                ))}
                <Button variant="outline" size="sm" onClick={addTier} className="self-start">
                    <Plus className="size-3.5" />
                    Добавить порог
                </Button>
            </div>
        </div>
    )
}
