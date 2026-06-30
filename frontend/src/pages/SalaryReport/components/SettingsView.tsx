import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Plus, Trash2, Check, X } from 'lucide-react'
import { salaryApi } from '../api'
import type { MotivationRule, CoefficientScale, Direction } from '../types'

type MoySkladFolder = { id: string; name: string; pathName: string; parentId: string | null }
type RoappCategory = { id: number; name: string; parentId: number | null; depth?: number }

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

function targetLabel(t: MotivationRule['items'][number]['target']) {
    return (
        t.moySkladFolder?.name ??
        t.roappServiceCategory?.name ??
        t.roappProductCategory?.name ??
        `${t.direction?.name ?? '—'} (всё направление)`
    )
}

// ── Форма добавления цели в правило ──────────────────────────────────────────

interface AddItemFormProps {
    rule: MotivationRule
    moySkladFolders: MoySkladFolder[]
    roappServiceCategories: RoappCategory[]
    roappProductCategories: RoappCategory[]
    onSave: () => void
    onCancel: () => void
}

function AddItemForm({ rule, moySkladFolders, roappServiceCategories, roappProductCategories, onSave, onCancel }: AddItemFormProps) {
    const isShop = rule.direction.name === 'Магазин'

    // category key: '' = whole direction, 'moy:id' or 'svc:id' or 'prd:id'
    const [categoryKey, setCategoryKey] = useState<string>('')
    const [metric, setMetric] = useState<'revenue' | 'margin'>('revenue')
    const [basePercent, setBasePercent] = useState('')
    const [saving, setSaving] = useState(false)

    async function handleSave() {
        const pct = parseFloat(basePercent.replace(',', '.'))
        if (isNaN(pct) || pct <= 0) return toast.error('Введите корректный % (число > 0)')
        setSaving(true)
        try {
            // Resolve category FK
            let moySkladFolderId: string | undefined
            let roappServiceCategoryId: number | undefined
            let roappProductCategoryId: number | undefined
            if (categoryKey.startsWith('moy:')) moySkladFolderId = categoryKey.slice(4)
            else if (categoryKey.startsWith('svc:')) roappServiceCategoryId = Number(categoryKey.slice(4))
            else if (categoryKey.startsWith('prd:')) roappProductCategoryId = Number(categoryKey.slice(4))

            const targetRes = await salaryApi.ensureTarget({
                directionId: rule.directionId,
                metric,
                moySkladFolderId,
                roappServiceCategoryId,
                roappProductCategoryId,
            })
            await salaryApi.createRuleItem(rule.id, { targetId: targetRes.data.id, basePercent: pct / 100 })
            toast.success('Цель добавлена')
            onSave()
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Ошибка')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/20 p-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
                {/* Category selector */}
                <select
                    value={categoryKey}
                    onChange={(e) => setCategoryKey(e.target.value)}
                    className="text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500 flex-1 min-w-[200px] max-w-xs"
                >
                    <option value="">Всё направление (без категории)</option>

                    {isShop && moySkladFolders.length > 0 && (
                        <optgroup label="Папки МойСклад">
                            {moySkladFolders.map((f) => (
                                <option key={f.id} value={`moy:${f.id}`}>{f.pathName || f.name}</option>
                            ))}
                        </optgroup>
                    )}

                    {!isShop && roappServiceCategories.length > 0 && (
                        <optgroup label="Категории услуг (Roapp)">
                            {roappServiceCategories.map((c) => (
                                <option key={c.id} value={`svc:${c.id}`}>
                                    {'  '.repeat(c.depth ?? 0)}{c.name}
                                </option>
                            ))}
                        </optgroup>
                    )}

                    {!isShop && roappProductCategories.length > 0 && (
                        <optgroup label="Категории товаров (Roapp)">
                            {roappProductCategories.map((c) => (
                                <option key={c.id} value={`prd:${c.id}`}>{c.name}</option>
                            ))}
                        </optgroup>
                    )}
                </select>

                {/* Metric */}
                <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as 'revenue' | 'margin')}
                    className="text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                >
                    <option value="revenue">Выручка</option>
                    <option value="margin">Прибыль</option>
                </select>

                {/* Base % */}
                <div className="flex items-center gap-1">
                    <input
                        type="text"
                        placeholder="% (напр. 10)"
                        value={basePercent}
                        onChange={(e) => setBasePercent(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                        className="w-24 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-500"
                        disabled={saving}
                    />
                    <span className="text-xs text-gray-400">%</span>
                </div>

                <button onClick={handleSave} disabled={saving} className="text-emerald-600 hover:text-emerald-700 p-1 disabled:opacity-40">
                    <Check className="size-4" />
                </button>
                <button onClick={onCancel} disabled={saving} className="text-gray-400 hover:text-gray-600 p-1">
                    <X className="size-4" />
                </button>
            </div>
            <p className="text-xs text-gray-400">
                Оставьте «Всё направление» чтобы считать по агрегату всего {rule.direction.name.toLowerCase()}а
            </p>
        </div>
    )
}

// ── Основной компонент ────────────────────────────────────────────────────────

export function SettingsView() {
    const [rules, setRules] = useState<MotivationRule[]>([])
    const [scales, setScales] = useState<CoefficientScale[]>([])
    const [directions, setDirections] = useState<Direction[]>([])
    const [moySkladFolders, setMoySkladFolders] = useState<MoySkladFolder[]>([])
    const [roappServiceCategories, setRoappServiceCategories] = useState<RoappCategory[]>([])
    const [roappProductCategories, setRoappProductCategories] = useState<RoappCategory[]>([])

    const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set())
    const [addingItemForRule, setAddingItemForRule] = useState<number | null>(null)

    const [addingRule, setAddingRule] = useState(false)
    const [newRuleName, setNewRuleName] = useState('')
    const [newRuleDir, setNewRuleDir] = useState(0)
    const [newRuleScale, setNewRuleScale] = useState(0)
    const [newRuleBase, setNewRuleBase] = useState<'margin' | 'revenue'>('margin')

    const [addingScale, setAddingScale] = useState(false)
    const [newScaleName, setNewScaleName] = useState('')

    async function reload() {
        const [rRes, sRes, dRes, mRes, rsRes, rpRes] = await Promise.all([
            salaryApi.getRules(),
            salaryApi.getScales(),
            salaryApi.getDirections(),
            salaryApi.getMoySkladFolders(),
            salaryApi.getRoappServiceCategories(),
            salaryApi.getRoappProductCategories(),
        ])
        setRules(rRes.data)
        setScales(sRes.data)
        setDirections(dRes.data)
        setMoySkladFolders(mRes.data)
        setRoappServiceCategories(rsRes.data)
        setRoappProductCategories(rpRes.data)
    }

    useEffect(() => {
        reload().catch(() => toast.error('Ошибка загрузки настроек'))
    }, [])

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

    async function deleteRuleItem(id: number) {
        await salaryApi.deleteRuleItem(id)
        await reload()
        toast.success('Удалено')
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

    return (
        <div className="flex flex-col gap-5">
            {/* ── Правила мотивации ──────────────────────────────────────────── */}
            <Section title="Правила мотивации">
                <div className="flex flex-col gap-2">
                    {rules.map((rule) => {
                        const expanded = expandedRules.has(rule.id)
                        return (
                            <div key={rule.id} className="rounded-lg border border-gray-200 overflow-hidden">
                                {/* Rule header */}
                                <div
                                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedRules((s) => {
                                        const n = new Set(s)
                                        n.has(rule.id) ? n.delete(rule.id) : n.add(rule.id)
                                        return n
                                    })}
                                >
                                    {expanded
                                        ? <ChevronDown className="size-4 text-gray-400 shrink-0" />
                                        : <ChevronRight className="size-4 text-gray-400 shrink-0" />}
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-sm text-gray-900">{rule.name}</span>
                                        <span className="ml-2 text-xs text-gray-400">
                                            {rule.direction.name} · шкала: {rule.scale.name}
                                        </span>
                                    </div>
                                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${rule.payoutBase === 'margin' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
                                        % от {rule.payoutBase === 'margin' ? 'прибыли' : 'выручки'}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteRule(rule.id) }}
                                        className="text-gray-300 hover:text-red-500 transition-colors p-1 ml-2 shrink-0"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>

                                {/* Rule items */}
                                {expanded && (
                                    <div className="border-t border-gray-100 bg-gray-50/30 px-4 py-3">
                                        {rule.items.length > 0 && (
                                            <table className="w-full text-sm mb-3">
                                                <thead>
                                                    <tr className="text-left text-xs text-gray-400 uppercase">
                                                        <th className="pb-2 font-medium">Категория / цель</th>
                                                        <th className="pb-2 font-medium">Метрика</th>
                                                        <th className="pb-2 font-medium text-right">Базовый %</th>
                                                        <th className="pb-2 w-8" />
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {rule.items.map((item) => (
                                                        <tr key={item.id}>
                                                            <td className="py-2 text-gray-700">{targetLabel(item.target)}</td>
                                                            <td className="py-2 text-gray-400 text-xs">
                                                                {item.target.metric === 'revenue' ? 'Выручка' : 'Прибыль'}
                                                            </td>
                                                            <td className="py-2 text-right font-medium text-gray-900 tabular-nums">
                                                                {(Number(item.basePercent) * 100).toFixed(1)}%
                                                            </td>
                                                            <td className="py-2 pl-2">
                                                                <button
                                                                    onClick={() => deleteRuleItem(item.id)}
                                                                    className="text-gray-200 hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}

                                        {addingItemForRule === rule.id ? (
                                            <AddItemForm
                                                rule={rule}
                                                moySkladFolders={moySkladFolders}
                                                roappServiceCategories={roappServiceCategories}
                                                roappProductCategories={roappProductCategories}
                                                onSave={async () => { await reload(); setAddingItemForRule(null) }}
                                                onCancel={() => setAddingItemForRule(null)}
                                            />
                                        ) : (
                                            <button
                                                onClick={() => setAddingItemForRule(rule.id)}
                                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
                                            >
                                                <Plus className="size-3.5" />
                                                Добавить цель в правило
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {/* New rule form */}
                    {addingRule ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2">
                                <input
                                    autoFocus
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
                                <button
                                    onClick={createRule}
                                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    <Check className="size-3.5" /> Создать
                                </button>
                                <button
                                    onClick={() => { setAddingRule(false); setNewRuleName('') }}
                                    className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                                >
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

            {/* ── Шкалы коэффициентов ───────────────────────────────────────── */}
            <Section title="Шкалы коэффициентов">
                <div className="flex flex-col gap-3">
                    {scales.map((scale) => (
                        <ScaleCard
                            key={scale.id}
                            scale={scale}
                            onDelete={() => deleteScale(scale.id)}
                            onCreatePoint={async (sid, p, c) => {
                                await salaryApi.createPoint(sid, { fulfillmentPct: p, coefficient: c })
                                await reload()
                            }}
                            onDeletePoint={async (id) => {
                                await salaryApi.deletePoint(id)
                                await reload()
                            }}
                        />
                    ))}

                    {addingScale ? (
                        <div className="flex items-center gap-2">
                            <input
                                autoFocus
                                placeholder="Название шкалы"
                                value={newScaleName}
                                onChange={(e) => setNewScaleName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') createScale() }}
                                className="text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-emerald-500 w-52"
                            />
                            <button onClick={createScale} className="text-emerald-600 hover:text-emerald-700">
                                <Check className="size-4" />
                            </button>
                            <button onClick={() => { setAddingScale(false); setNewScaleName('') }} className="text-gray-400 hover:text-gray-600">
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

// ── Карточка шкалы ─────────────────────────────────────────────────────────

function ScaleCard({
    scale,
    onDelete,
    onCreatePoint,
    onDeletePoint,
}: {
    scale: CoefficientScale
    onDelete: () => void
    onCreatePoint: (scaleId: number, pct: number, coef: number) => Promise<void>
    onDeletePoint: (id: number) => Promise<void>
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
                        <span className="font-medium tabular-nums">×{Number(pt.coefficient).toFixed(2)}</span>
                        <button
                            onClick={() => onDeletePoint(pt.id)}
                            className="ml-0.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
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
                            className="w-20 text-xs border border-gray-200 rounded-full px-2 py-1 focus:outline-none focus:border-emerald-500 tabular-nums"
                        />
                        <span className="text-gray-400 text-xs">→ ×</span>
                        <input
                            placeholder="коэф."
                            value={coef}
                            onChange={(e) => setCoef(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
                            className="w-16 text-xs border border-gray-200 rounded-full px-2 py-1 focus:outline-none focus:border-emerald-500 tabular-nums"
                        />
                        <button onClick={save} className="text-emerald-600 hover:text-emerald-700">
                            <Check className="size-3.5" />
                        </button>
                        <button onClick={() => { setAddingPoint(false); setPct(''); setCoef('') }} className="text-gray-400 hover:text-gray-600">
                            <X className="size-3.5" />
                        </button>
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
                Линейная интерполяция между точками · зажим за крайними значениями
            </p>
        </div>
    )
}
