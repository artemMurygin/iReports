import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lock } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { cn } from '@/lib/utils'
import { salaryApi } from '../api'
import { categoriesQuery } from '../queries'
import { ProgressionCurveEditor } from './ProgressionCurveEditor'
import type { Direction, Goal, GoalType, KpiDirection, KpiStat, ManagerRole, ProgressionTier, RewardType } from '../types'

interface Props {
    ruleId: number
    goal?: Goal
    onCreated: () => void
    onCancel: () => void
}

const KPI_STATS: KpiStat[] = ['REVENUE', 'MARGIN', 'MARGIN_MINUS_ENGINEER', 'PCS', 'COSTS']

const KPI_STAT_LABELS: Record<KpiStat, string> = {
    REVENUE: 'Выручка',
    MARGIN: 'Маржа',
    MARGIN_MINUS_ENGINEER: 'Маржа − ИТР',
    PCS: 'Штуки',
    COSTS: 'Затраты',
}

const selectCls = 'h-8 px-2 rounded-lg border border-gray-200 text-sm bg-white disabled:opacity-50 focus:outline-none focus:border-gray-400'
const labelCls = 'text-xs font-medium text-gray-500'
const fieldCls = 'flex flex-col gap-1'

export function GoalForm({ ruleId, goal, onCreated, onCancel }: Props) {
    const isEdit = goal != null

    const [type, setType] = useState<GoalType>(goal?.type ?? 'KPI')
    const [direction, setDirection] = useState<Direction>(goal?.direction ?? 'SERVICE')
    const [managerRole, setManagerRole] = useState<ManagerRole>(goal?.managerRole ?? 'OFFLINE')
    const [name, setName] = useState(goal?.name ?? '')
    const [nameError, setNameError] = useState(false)
    const [kpiDirection, setKpiDirection] = useState<KpiDirection>(goal?.kpiDirection ?? 'SALES')
    const [measureStat, setMeasureStat] = useState<KpiStat>(goal?.measureStat ?? 'REVENUE')
    const [categoryExtId, setCategoryExtId] = useState<string | null>(goal?.categoryExtId ?? null)

    const [rewardName, setRewardName] = useState(goal?.reward.name ?? 'Вознаграждение')
    const [rewardType, setRewardType] = useState<RewardType>(goal?.reward.type ?? 'PERCENT')
    const [rewardValue, setRewardValue] = useState(goal?.reward.value ?? 1000)
    const [baseStat, setBaseStat] = useState<KpiStat>(goal?.reward.baseStat ?? 'MARGIN_MINUS_ENGINEER')
    const [tiers, setTiers] = useState<ProgressionTier[]>(
        goal?.reward.tiers.length
            ? goal.reward.tiers
            : [
                  { fromPct: 0, toPct: 70, mode: 'FIXED', coef: 0.5, coefFrom: null, coefTo: null },
                  { fromPct: 70, toPct: 120, mode: 'LINEAR', coef: null, coefFrom: 0.5, coefTo: 1 },
                  { fromPct: 120, toPct: null, mode: 'MULTIPLIER', coef: 1.2, coefFrom: null, coefTo: null },
              ],
    )

    const { data: categories = [] } = useQuery({
        ...categoriesQuery(direction),
        enabled: type === 'KPI',
    })

    const { mutate, isPending: saving } = useMutation({
        mutationFn: async () => {
            const rewardPayload = {
                name: rewardName,
                type: rewardType,
                value: rewardValue,
                baseStat: rewardType === 'PERCENT' ? baseStat : null,
                tiers,
            }
            const goalPayload = {
                name,
                managerRole,
                kpiDirection: type === 'KPI' ? kpiDirection : null,
                measureStat: type === 'KPI' ? measureStat : null,
                categoryExtId: type === 'KPI' ? categoryExtId : null,
            }
            if (isEdit) {
                await salaryApi.updateReward(goal.reward.id, rewardPayload)
                await salaryApi.updateGoal(goal.id, goalPayload)
            } else {
                const rewardRes = await salaryApi.createReward(rewardPayload)
                await salaryApi.createGoal({
                    ...goalPayload,
                    ruleId,
                    type,
                    direction,
                    sortOrder: 0,
                    rewardId: rewardRes.data.id,
                })
            }
        },
        onSuccess: () => {
            toast.success(isEdit ? 'Цель обновлена' : 'Цель добавлена')
            onCreated()
        },
        onError: (e) => {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            toast.error(Array.isArray(message) ? message.join('; ') : message ?? 'Не удалось сохранить цель')
        },
    })

    function handleTypeChange(newType: GoalType) {
        setType(newType)
        if (newType !== 'KPI') setCategoryExtId(null)
    }

    function handleSubmit() {
        if (!name.trim()) {
            setNameError(true)
            return
        }
        mutate()
    }

    return (
        <div aria-busy={saving} className="flex flex-col gap-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50/30">

            {/* A — Название */}
            <div className={fieldCls}>
                <label htmlFor="goal-name" className={labelCls}>Название цели</label>
                <input
                    id="goal-name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (nameError) setNameError(false) }}
                    disabled={saving}
                    aria-invalid={nameError}
                    aria-describedby={nameError ? 'goal-name-error' : undefined}
                    placeholder="Например: План по выручке"
                    className={cn(
                        'h-8 px-3 rounded-lg border text-sm w-full focus:outline-none focus:border-gray-400 disabled:opacity-50',
                        nameError ? 'border-red-400 ring-1 ring-red-300/50' : 'border-gray-200',
                    )}
                />
                {nameError && (
                    <p id="goal-name-error" className="text-xs text-red-500">Укажите название цели</p>
                )}
            </div>

            {/* B — Тип / Направление / Менеджер */}
            <div className="flex flex-wrap items-end gap-3">
                {isEdit ? (
                    <div className={fieldCls}>
                        <span className={labelCls}>Тип / Направление</span>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-100 text-sm text-gray-500 select-none">
                                <Lock className="size-3 text-gray-400" />
                                {type === 'KPI' ? 'KPI' : 'Задача'}
                            </span>
                            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-100 text-sm text-gray-500 select-none">
                                <Lock className="size-3 text-gray-400" />
                                {direction === 'SERVICE' ? 'Сервис' : 'Магазин'}
                            </span>
                            <span className="text-xs text-gray-400">Нельзя изменить после создания</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={fieldCls}>
                            <label htmlFor="goal-type" className={labelCls}>Тип</label>
                            <select
                                id="goal-type"
                                value={type}
                                onChange={(e) => handleTypeChange(e.target.value as GoalType)}
                                disabled={saving}
                                className={selectCls}
                            >
                                <option value="KPI">KPI</option>
                                <option value="TASK">Задача</option>
                            </select>
                        </div>
                        <div className={fieldCls}>
                            <label htmlFor="goal-direction" className={labelCls}>Направление</label>
                            <select
                                id="goal-direction"
                                value={direction}
                                onChange={(e) => setDirection(e.target.value as Direction)}
                                disabled={saving}
                                className={selectCls}
                            >
                                <option value="SERVICE">Сервис</option>
                                <option value="SHOP">Магазин</option>
                            </select>
                        </div>
                    </>
                )}
                <div className={fieldCls}>
                    <label htmlFor="goal-manager-role" className={labelCls}>Менеджер</label>
                    <select
                        id="goal-manager-role"
                        value={managerRole}
                        onChange={(e) => setManagerRole(e.target.value as ManagerRole)}
                        disabled={saving}
                        className={selectCls}
                    >
                        <option value="OFFLINE">Офлайн</option>
                        <option value="ONLINE">Онлайн</option>
                        <option value="BOTH">Оба</option>
                    </select>
                </div>
            </div>

            {/* C — KPI параметры */}
            {type === 'KPI' && (
                <div className="flex flex-wrap items-end gap-3">
                    <div className={fieldCls}>
                        <label htmlFor="goal-kpi-dir" className={labelCls}>Направление KPI</label>
                        <select
                            id="goal-kpi-dir"
                            value={kpiDirection}
                            onChange={(e) => setKpiDirection(e.target.value as KpiDirection)}
                            disabled={saving}
                            className={selectCls}
                        >
                            <option value="SALES">Продажи</option>
                            <option value="TURNOVER">Оборачиваемость</option>
                        </select>
                    </div>
                    <div className={fieldCls}>
                        <label htmlFor="goal-measure" className={labelCls}>Метрика</label>
                        <select
                            id="goal-measure"
                            value={measureStat}
                            onChange={(e) => setMeasureStat(e.target.value as KpiStat)}
                            disabled={saving}
                            className={selectCls}
                        >
                            {KPI_STATS.map((s) => (
                                <option key={s} value={s}>{KPI_STAT_LABELS[s]}</option>
                            ))}
                        </select>
                    </div>
                    <div className={fieldCls}>
                        <label htmlFor="goal-category" className={labelCls}>Категория</label>
                        <select
                            id="goal-category"
                            value={categoryExtId ?? ''}
                            onChange={(e) => setCategoryExtId(e.target.value || null)}
                            disabled={saving}
                            className={cn(selectCls, 'min-w-40')}
                        >
                            <option value="">Всё направление</option>
                            {categories.map((c) => (
                                <option key={String(c.id)} value={String(c.id)}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="h-px bg-emerald-200" />

            {/* D — Вознаграждение */}
            <div className="flex flex-wrap items-end gap-3">
                <div className={cn(fieldCls, 'flex-1 min-w-40')}>
                    <label htmlFor="reward-name" className={labelCls}>Название вознаграждения</label>
                    <input
                        id="reward-name"
                        value={rewardName}
                        onChange={(e) => setRewardName(e.target.value)}
                        disabled={saving}
                        className="h-8 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-gray-400 disabled:opacity-50"
                    />
                </div>
                <div className={fieldCls}>
                    <label htmlFor="reward-type" className={labelCls}>Тип</label>
                    <select
                        id="reward-type"
                        value={rewardType}
                        onChange={(e) => setRewardType(e.target.value as RewardType)}
                        disabled={saving}
                        className={selectCls}
                    >
                        <option value="PERCENT">% от базы</option>
                        <option value="FIX">Фикс. сумма</option>
                    </select>
                </div>
                <div className={fieldCls}>
                    <label htmlFor="reward-value" className={labelCls}>
                        {rewardType === 'PERCENT' ? 'Размер (×100, 1000=10%)' : 'Сумма, ₽'}
                    </label>
                    <input
                        id="reward-value"
                        type="number"
                        value={rewardValue}
                        onChange={(e) => setRewardValue(Number(e.target.value))}
                        disabled={saving}
                        className="h-8 px-3 rounded-lg border border-gray-200 text-sm w-36 tabular-nums focus:outline-none focus:border-gray-400 disabled:opacity-50"
                    />
                </div>
                {rewardType === 'PERCENT' && (
                    <div className={fieldCls}>
                        <label htmlFor="base-stat" className={labelCls}>База расчёта</label>
                        <select
                            id="base-stat"
                            value={baseStat}
                            onChange={(e) => setBaseStat(e.target.value as KpiStat)}
                            disabled={saving}
                            className={selectCls}
                        >
                            {KPI_STATS.map((s) => (
                                <option key={s} value={s}>{KPI_STAT_LABELS[s]}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* E — Прогрессия */}
            <fieldset disabled={saving} className="contents">
                <ProgressionCurveEditor tiers={tiers} onChange={setTiers} />
            </fieldset>

            {/* F — Кнопки */}
            <div className="flex items-center gap-2 self-end">
                <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
                    Отмена
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={saving}>
                    {saving ? 'Сохранение…' : isEdit ? 'Сохранить изменения' : 'Сохранить цель'}
                </Button>
            </div>
        </div>
    )
}
