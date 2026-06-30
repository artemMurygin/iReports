import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { salaryApi } from '../api'
import type { MotivationRule, CoefficientScale, MotivationTarget, Direction } from '../types'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
            </div>
            <div className="p-4">{children}</div>
        </div>
    )
}

function InlineInput({ defaultValue, onSave, placeholder = '' }: { defaultValue: string; onSave: (v: string) => Promise<void>; placeholder?: string }) {
    const [val, setVal] = useState(defaultValue)
    const [saving, setSaving] = useState(false)
    return (
        <div className="flex items-center gap-1.5">
            <input
                autoFocus
                value={val}
                onChange={(e) => setVal(e.target.value)}
                placeholder={placeholder}
                onKeyDown={async (e) => {
                    if (e.key === 'Enter') { setSaving(true); await onSave(val); setSaving(false) }
                }}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-emerald-500 w-48"
                disabled={saving}
            />
            <button
                onClick={async () => { setSaving(true); await onSave(val); setSaving(false) }}
                disabled={saving}
                className="text-emerald-600 hover:text-emerald-700"
            >
                <Check className="size-4" />
            </button>
        </div>
    )
}

export function SettingsView() {
    const [rules, setRules] = useState<MotivationRule[]>([])
    const [scales, setScales] = useState<CoefficientScale[]>([])
    const [targets, setTargets] = useState<MotivationTarget[]>([])
    const [directions, setDirections] = useState<Direction[]>([])
    const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set())
    const [addingRule, setAddingRule] = useState(false)
    const [addingScale, setAddingScale] = useState(false)
    const [newRuleName, setNewRuleName] = useState('')
    const [newRuleDir, setNewRuleDir] = useState(0)
    const [newRuleScale, setNewRuleScale] = useState(0)
    const [newRuleBase, setNewRuleBase] = useState<'margin' | 'revenue'>('margin')
    const [newScaleName, setNewScaleName] = useState('')
    const [addingItemForRule, setAddingItemForRule] = useState<number | null>(null)
    const [newItemTarget, setNewItemTarget] = useState(0)
    const [newItemPct, setNewItemPct] = useState('')

    async function reload() {
        const [rRes, sRes, tRes, dRes] = await Promise.all([
            salaryApi.getRules(),
            salaryApi.getScales(),
            salaryApi.getTargets(),
            salaryApi.getDirections(),
        ])
        setRules(rRes.data)
        setScales(sRes.data)
        setTargets(tRes.data)
        setDirections(dRes.data)
    }

    useEffect(() => {
        reload().catch(() => toast.error('Ошибка загрузки настроек'))
    }, [])

    function targetName(t: MotivationTarget) {
        return t.moySkladFolder?.name ?? t.roappServiceCategory?.name ?? t.roappProductCategory?.name ?? `${t.direction.name} (всё направление)`
    }

    async function createRule() {
        if (!newRuleName || !newRuleDir || !newRuleScale) return toast.error('Заполните все поля')
        try {
            await salaryApi.createRule({ name: newRuleName, directionId: newRuleDir, scaleId: newRuleScale, payoutBase: newRuleBase })
            await reload()
            setAddingRule(false)
            setNewRuleName(''); setNewRuleDir(0); setNewRuleScale(0)
            toast.success('Правило создано')
        } catch { toast.error('Ошибка создания правила') }
    }

    async function deleteRule(id: number) {
        try {
            await salaryApi.deleteRule(id)
            await reload()
            toast.success('Правило удалено')
        } catch { toast.error('Ошибка') }
    }

    async function createScale() {
        if (!newScaleName) return
        try {
            await salaryApi.createScale(newScaleName)
            await reload()
            setAddingScale(false)
            setNewScaleName('')
            toast.success('Шкала создана')
        } catch { toast.error('Ошибка') }
    }

    async function deleteScale(id: number) {
        try {
            await salaryApi.deleteScale(id)
            await reload()
            toast.success('Шкала удалена')
        } catch { toast.error('Ошибка') }
    }

    async function createPoint(scaleId: number, fulfillmentPct: number, coefficient: number) {
        await salaryApi.createPoint(scaleId, { fulfillmentPct, coefficient })
        await reload()
    }

    async function deletePoint(id: number) {
        await salaryApi.deletePoint(id)
        await reload()
    }

    async function addRuleItem(ruleId: number) {
        if (!newItemTarget) return toast.error('Выберите цель')
        const pct = parseFloat(newItemPct.replace(',', '.'))
        if (isNaN(pct)) return toast.error('Введите корректный % ')
        try {
            await salaryApi.createRuleItem(ruleId, { targetId: newItemTarget, basePercent: pct / 100 })
            await reload()
            setAddingItemForRule(null)
            setNewItemTarget(0); setNewItemPct('')
            toast.success('Цель добавлена в правило')
        } catch { toast.error('Ошибка') }
    }

    async function deleteRuleItem(id: number) {
        await salaryApi.deleteRuleItem(id)
        await reload()
        toast.success('Удалено')
    }

    return (
        <div className="flex flex-col gap-5">
            {/* ── Правила мотивации ─────────────────────────────────────────────── */}
            <Section title="Правила мотивации">
                <div className="flex flex-col gap-2">
                    {rules.map((rule) => {
                        const expanded = expandedRules.has(rule.id)
                        const ruleTargets = targets.filter((t) => !rule.items.some((i) => i.targetId === t.id))
                        return (
                            <div key={rule.id} className="rounded-lg border border-gray-200 overflow-hidden">
                                <div
                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedRules((s) => {
                                        const n = new Set(s)
                                        n.has(rule.id) ? n.delete(rule.id) : n.add(rule.id)
                                        return n
                                    })}
                                >
                                    {expanded ? <ChevronDown className="size-4 text-gray-400" /> : <ChevronRight className="size-4 text-gray-400" />}
                                    <div className="flex-1">
                                        <span className="font-medium text-sm text-gray-900">{rule.name}</span>
                                        <span className="ml-2 text-xs text-gray-400">{rule.direction.name} · шкала: {rule.scale.name}</span>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${rule.payoutBase === 'margin' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
                                        % от {rule.payoutBase === 'margin' ? 'прибыли' : 'выручки'}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteRule(rule.id) }}
                                        className="text-gray-300 hover:text-red-500 transition-colors p-1 ml-2"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>

                                {expanded && (
                                    <div className="border-t border-gray-100 bg-gray-50/30 px-4 py-3">
                                        <table className="w-full text-sm mb-3">
                                            <thead>
                                                <tr className="text-left text-xs text-gray-400 uppercase">
                                                    <th className="pb-2 font-medium">Цель</th>
                                                    <th className="pb-2 font-medium">Метрика</th>
                                                    <th className="pb-2 font-medium text-right">Базовый %</th>
                                                    <th className="pb-2 w-8" />
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {rule.items.map((item) => (
                                                    <tr key={item.id}>
                                                        <td className="py-2 text-gray-700">{targetName(item.target)}</td>
                                                        <td className="py-2 text-gray-400 text-xs">
                                                            {item.target.metric === 'revenue' ? 'Выручка' : 'Прибыль'}
                                                        </td>
                                                        <td className="py-2 text-right font-medium text-gray-900 tabular-nums">
                                                            {(Number(item.basePercent) * 100).toFixed(1)}%
                                                        </td>
                                                        <td className="py-2 pl-2">
                                                            <button onClick={() => deleteRuleItem(item.id)} className="text-gray-200 hover:text-red-500 transition-colors">
                                                                <Trash2 className="size-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        {addingItemForRule === rule.id ? (
                                            <div className="flex items-center gap-2 mt-1">
                                                <select
                                                    value={newItemTarget}
                                                    onChange={(e) => setNewItemTarget(Number(e.target.value))}
                                                    className="text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500 flex-1"
                                                >
                                                    <option value={0}>— цель —</option>
                                                    {ruleTargets.map((t) => (
                                                        <option key={t.id} value={t.id}>{t.direction.name} / {targetName(t)}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="text"
                                                    placeholder="% (напр. 10)"
                                                    value={newItemPct}
                                                    onChange={(e) => setNewItemPct(e.target.value)}
                                                    className="w-24 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                                                />
                                                <button onClick={() => addRuleItem(rule.id)} className="text-emerald-600 hover:text-emerald-700 p-1">
                                                    <Check className="size-4" />
                                                </button>
                                                <button onClick={() => { setAddingItemForRule(null); setNewItemTarget(0); setNewItemPct('') }} className="text-gray-400 hover:text-gray-600 p-1">
                                                    <X className="size-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setAddingItemForRule(rule.id)}
                                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
                                            >
                                                <Plus className="size-3.5" />
                                                Добавить цель
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {addingRule ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 flex flex-col gap-3">
                            <div className="flex flex-wrap gap-3">
                                <input
                                    placeholder="Название правила"
                                    value={newRuleName}
                                    onChange={(e) => setNewRuleName(e.target.value)}
                                    className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500 flex-1 min-w-[160px]"
                                />
                                <select
                                    value={newRuleDir}
                                    onChange={(e) => setNewRuleDir(Number(e.target.value))}
                                    className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value={0}>— направление —</option>
                                    {directions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <select
                                    value={newRuleScale}
                                    onChange={(e) => setNewRuleScale(Number(e.target.value))}
                                    className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value={0}>— шкала —</option>
                                    {scales.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <select
                                    value={newRuleBase}
                                    onChange={(e) => setNewRuleBase(e.target.value as 'margin' | 'revenue')}
                                    className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="margin">% от прибыли</option>
                                    <option value="revenue">% от выручки</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={createRule} className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                                    <Check className="size-3.5" /> Создать
                                </button>
                                <button onClick={() => { setAddingRule(false); setNewRuleName('') }} className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700 transition-colors">
                                    Отмена
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setAddingRule(true)}
                            className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
                        >
                            <Plus className="size-4" />
                            Добавить правило
                        </button>
                    )}
                </div>
            </Section>

            {/* ── Шкалы коэффициентов ───────────────────────────────────────────── */}
            <Section title="Шкалы коэффициентов">
                <div className="flex flex-col gap-3">
                    {scales.map((scale) => (
                        <ScaleCard
                            key={scale.id}
                            scale={scale}
                            onDelete={() => deleteScale(scale.id)}
                            onCreatePoint={createPoint}
                            onDeletePoint={deletePoint}
                        />
                    ))}

                    {addingScale ? (
                        <div className="flex items-center gap-2">
                            <InlineInput
                                defaultValue=""
                                placeholder="Название шкалы"
                                onSave={async (v) => { setNewScaleName(v); await createScale() }}
                            />
                            <button onClick={() => setAddingScale(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="size-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setAddingScale(true)}
                            className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-400 hover:text-gray-700 hover:border-gray-300 transition-colors"
                        >
                            <Plus className="size-4" />
                            Добавить шкалу
                        </button>
                    )}
                </div>
            </Section>
        </div>
    )
}

function ScaleCard({
    scale,
    onDelete,
    onCreatePoint,
    onDeletePoint,
}: {
    scale: CoefficientScale
    onDelete: () => void
    onCreatePoint: (scaleId: number, pct: number, coef: number) => Promise<void>
    onDeletePoint: (id: number) => void
}) {
    const [addingPoint, setAddingPoint] = useState(false)
    const [pct, setPct] = useState('')
    const [coef, setCoef] = useState('')

    async function save() {
        const p = parseFloat(pct.replace(',', '.'))
        const c = parseFloat(coef.replace(',', '.'))
        if (isNaN(p) || isNaN(c)) return toast.error('Введите числа')
        await onCreatePoint(scale.id, p / 100, c)
        setAddingPoint(false)
        setPct(''); setCoef('')
        toast.success('Точка добавлена')
    }

    return (
        <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm text-gray-900">{scale.name}</span>
                <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="size-3.5" />
                </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
                {scale.points.map((pt) => (
                    <div key={pt.id} className="group relative flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-700">
                        <span className="tabular-nums">{(Number(pt.fulfillmentPct) * 100).toFixed(0)}%</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium tabular-nums">{Number(pt.coefficient).toFixed(2)}</span>
                        <button
                            onClick={() => onDeletePoint(pt.id)}
                            className="ml-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                ))}

                {addingPoint ? (
                    <div className="flex items-center gap-1.5">
                        <input
                            autoFocus
                            placeholder="выполн. %"
                            value={pct}
                            onChange={(e) => setPct(e.target.value)}
                            className="w-20 text-xs border border-gray-200 rounded-full px-2 py-1 focus:outline-none focus:border-emerald-500"
                        />
                        <span className="text-gray-400 text-xs">→</span>
                        <input
                            placeholder="коэф."
                            value={coef}
                            onChange={(e) => setCoef(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
                            className="w-16 text-xs border border-gray-200 rounded-full px-2 py-1 focus:outline-none focus:border-emerald-500"
                        />
                        <button onClick={save} className="text-emerald-600 hover:text-emerald-700"><Check className="size-3.5" /></button>
                        <button onClick={() => { setAddingPoint(false); setPct(''); setCoef('') }} className="text-gray-400 hover:text-gray-600"><X className="size-3.5" /></button>
                    </div>
                ) : (
                    <button
                        onClick={() => setAddingPoint(true)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors bg-gray-50 rounded-full px-3 py-1 border border-dashed border-gray-200"
                    >
                        <Plus className="size-3" /> точка
                    </button>
                )}
            </div>
            <p className="text-xs text-gray-400">
                Линейная интерполяция между точками, зажим за крайними значениями
            </p>
        </div>
    )
}
