import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format, startOfMonth } from 'date-fns'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { PeriodPicker } from './PeriodPicker'
import { salaryApi } from '../api'
import type { Plan, Fact, MotivationTarget, Direction } from '../types'

interface Row {
    target: MotivationTarget
    plan: Plan | null
    fact: Fact | null
}

function money(v: string | null) {
    if (!v) return '—'
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(v))
}

function EditableCell({
    value,
    onSave,
}: {
    value: string | null
    onSave: (val: number) => Promise<void>
}) {
    const [editing, setEditing] = useState(false)
    const [input, setInput] = useState(value ?? '')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        const num = parseFloat(input.replace(/\s/g, '').replace(',', '.'))
        if (isNaN(num)) return
        setSaving(true)
        await onSave(num)
        setSaving(false)
        setEditing(false)
    }

    if (editing) {
        return (
            <div className="flex items-center gap-1">
                <input
                    autoFocus
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
                    className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-emerald-500 tabular-nums"
                    disabled={saving}
                />
                <button onClick={handleSave} disabled={saving} className="text-emerald-600 hover:text-emerald-700 p-0.5">
                    <Check className="size-3.5" />
                </button>
                <button onClick={() => setEditing(false)} disabled={saving} className="text-gray-400 hover:text-gray-600 p-0.5">
                    <X className="size-3.5" />
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={() => { setInput(value ?? ''); setEditing(true) }}
            className="group flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 tabular-nums"
        >
            {value ? money(value) : <span className="text-gray-300 italic">не задан</span>}
            <Pencil className="size-3 opacity-0 group-hover:opacity-40 transition-opacity" />
        </button>
    )
}

export function PlanFactView() {
    const [period, setPeriod] = useState<Date>(startOfMonth(new Date()))
    const [rows, setRows] = useState<Row[]>([])
    const [targets, setTargets] = useState<MotivationTarget[]>([])
    const [directions, setDirections] = useState<Direction[]>([])
    const [loading, setLoading] = useState(false)
    const [addingTarget, setAddingTarget] = useState<number | null>(null)
    const [newPlan, setNewPlan] = useState('')
    const [newFact, setNewFact] = useState('')

    const periodStr = format(period, 'yyyy-MM-dd')

    async function load() {
        setLoading(true)
        try {
            const [tRes, pRes, fRes, dRes] = await Promise.all([
                salaryApi.getTargets(),
                salaryApi.getPlans(periodStr),
                salaryApi.getFacts(periodStr),
                salaryApi.getDirections(),
            ])
            const allTargets = tRes.data
            const plans = pRes.data
            const facts = fRes.data
            setTargets(allTargets)
            setDirections(dRes.data)
            setRows(
                allTargets.map((t) => ({
                    target: t,
                    plan: plans.find((p) => p.targetId === t.id) ?? null,
                    fact: facts.find((f) => f.targetId === t.id) ?? null,
                })),
            )
        } catch {
            toast.error('Не удалось загрузить данные')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [period])

    function targetName(t: MotivationTarget) {
        return t.moySkladFolder?.name ?? t.roappServiceCategory?.name ?? t.roappProductCategory?.name ?? `${t.direction.name} (всё направление)`
    }

    async function savePlan(row: Row, value: number) {
        try {
            if (row.plan) {
                await salaryApi.updatePlan(row.plan.id, value)
            } else {
                await salaryApi.createPlan({ targetId: row.target.id, period: periodStr, value })
            }
            await load()
            toast.success('План сохранён')
        } catch {
            toast.error('Не удалось сохранить план')
        }
    }

    async function saveFact(row: Row, value: number) {
        try {
            if (row.fact) {
                await salaryApi.updateFact(row.fact.id, { value })
            } else {
                await salaryApi.createFact({ targetId: row.target.id, period: periodStr, value, source: 'manual' })
            }
            await load()
            toast.success('Факт сохранён')
        } catch {
            toast.error('Не удалось сохранить факт')
        }
    }

    async function deletePlan(id: number) {
        await salaryApi.deletePlan(id)
        await load()
        toast.success('Удалено')
    }

    async function deleteFact(id: number) {
        await salaryApi.deleteFact(id)
        await load()
        toast.success('Удалено')
    }

    const unusedTargets = targets.filter((t) => !rows.some((r) => r.target.id === t.id))

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <PeriodPicker value={period} onChange={setPeriod} />
                {loading && <span className="text-xs text-gray-400 animate-pulse">Загрузка...</span>}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-left">
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Направление</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Цель</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Метрика</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">План</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Факт</th>
                            <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Источник</th>
                            <th className="px-4 py-3 w-16" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows.map((row) => (
                            <tr key={row.target.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3 text-gray-500">{row.target.direction.name}</td>
                                <td className="px-4 py-3 font-medium text-gray-900">{targetName(row.target)}</td>
                                <td className="px-4 py-3">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${row.target.metric === 'margin' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
                                        {row.target.metric === 'revenue' ? 'Выручка' : 'Прибыль'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <EditableCell
                                        value={row.plan?.value ?? null}
                                        onSave={(v) => savePlan(row, v)}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <EditableCell
                                        value={row.fact?.value ?? null}
                                        onSave={(v) => saveFact(row, v)}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    {row.fact ? (
                                        <span className="text-xs text-gray-400">
                                            {row.fact.source === 'moy_sklad' ? 'МойСклад' : row.fact.source === 'roapp' ? 'Roapp' : 'Вручную'}
                                        </span>
                                    ) : null}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-1 justify-end">
                                        {row.plan && (
                                            <button onClick={() => deletePlan(row.plan!.id)} className="text-gray-300 hover:text-red-500 p-1 transition-colors" title="Удалить план">
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        )}
                                        {row.fact && (
                                            <button onClick={() => deleteFact(row.fact!.id)} className="text-gray-300 hover:text-red-500 p-1 transition-colors" title="Удалить факт">
                                                <Trash2 className="size-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}

                        {addingTarget !== null && (
                            <tr className="bg-emerald-50/30">
                                <td colSpan={3} className="px-4 py-3">
                                    <select
                                        value={addingTarget}
                                        onChange={(e) => setAddingTarget(Number(e.target.value))}
                                        className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500 w-full max-w-xs"
                                    >
                                        <option value={0}>— выберите цель —</option>
                                        {unusedTargets.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.direction.name} / {targetName(t)}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-4 py-3">
                                    <input
                                        type="text"
                                        placeholder="план"
                                        value={newPlan}
                                        onChange={(e) => setNewPlan(e.target.value)}
                                        className="w-28 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-emerald-500"
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    <input
                                        type="text"
                                        placeholder="факт"
                                        value={newFact}
                                        onChange={(e) => setNewFact(e.target.value)}
                                        className="w-28 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-emerald-500"
                                    />
                                </td>
                                <td />
                                <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                        <button
                                            onClick={async () => {
                                                if (!addingTarget) return
                                                try {
                                                    const p = parseFloat(newPlan.replace(',', '.'))
                                                    const f = parseFloat(newFact.replace(',', '.'))
                                                    if (!isNaN(p)) await salaryApi.createPlan({ targetId: addingTarget, period: periodStr, value: p })
                                                    if (!isNaN(f)) await salaryApi.createFact({ targetId: addingTarget, period: periodStr, value: f, source: 'manual' })
                                                    await load()
                                                    setAddingTarget(null)
                                                    setNewPlan('')
                                                    setNewFact('')
                                                    toast.success('Добавлено')
                                                } catch {
                                                    toast.error('Ошибка')
                                                }
                                            }}
                                            className="text-emerald-600 hover:text-emerald-700 p-1"
                                        >
                                            <Check className="size-4" />
                                        </button>
                                        <button onClick={() => { setAddingTarget(null); setNewPlan(''); setNewFact('') }} className="text-gray-400 hover:text-gray-600 p-1">
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {addingTarget === null && (
                    <div className="border-t border-gray-100 px-4 py-2">
                        <button
                            onClick={() => setAddingTarget(0)}
                            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
                        >
                            <Plus className="size-4" />
                            Добавить строку
                        </button>
                    </div>
                )}
            </div>

            <p className="text-xs text-gray-400">
                Нажмите на значение плана или факта для редактирования
            </p>
        </div>
    )
}
