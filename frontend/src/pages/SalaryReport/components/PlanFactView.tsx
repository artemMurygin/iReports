import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, User, Building2 } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Button } from '@/shared/ui/button'
import { salaryApi } from '../api'
import { employeesQuery, departmentsQuery, planFactQuery, categoriesQuery } from '../queries'
import { EmployeeSelect } from './EmployeeSelect'
import { MultiSelect } from './MultiSelect'
import { CreatePlanModal } from './CreatePlanModal'
import { MonthPicker } from '@/shared/ui/month-picker'
import { currentPeriod } from '../utils/period'
import { money } from '../utils/format'
import type {
    CategoryNode,
    Department,
    Direction,
    Employee,
    KpiStat,
    PlanFactRow,
    Scope,
} from '../types'

const KPI_STATS: KpiStat[] = ['REVENUE', 'MARGIN', 'MARGIN_MINUS_ENGINEER', 'PCS', 'COSTS']

const STAT_LABELS: Record<KpiStat, string> = {
    REVENUE: 'Выручка',
    MARGIN: 'Маржа',
    MARGIN_MINUS_ENGINEER: 'Маржа−инженер',
    PCS: 'Шт.',
    COSTS: 'Затраты',
}

const DIRECTION_STYLE: Record<
    Direction,
    { label: string; bg: string; tagBg: string; color: string }
> = {
    SERVICE: { label: 'Сервис', bg: '#eff6ff', tagBg: '#dbeafe', color: '#2563eb' },
    SHOP: { label: 'Магазин', bg: '#f5f3ff', tagBg: '#ede9fe', color: '#7c3aed' },
}

type EntityFilter = 'all' | 'employee' | 'department'

// columns: metric | progress | plan | fact | %
const COLS = '140px 1fr 116px 116px 58px'

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtPeriod(period: string): string {
    const [y, m] = period.split('-')
    return format(new Date(Number(y), Number(m) - 1), 'LLLL yyyy', { locale: ru })
}

function getExpectedPct(period: string): number {
    const [y, m] = period.split('-').map(Number)
    const now = new Date()
    const yr = now.getFullYear(),
        mo = now.getMonth() + 1
    if (y > yr || (y === yr && m > mo)) return 0
    if (y < yr || (y === yr && m < mo)) return 100
    const days = new Date(y, m, 0).getDate()
    return Math.round((now.getDate() / days) * 100)
}

function getMonthProgress(period: string) {
    const [y, m] = period.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const now = new Date()
    const yr = now.getFullYear(),
        mo = now.getMonth() + 1
    if (y > yr || (y === yr && m > mo)) return { day: 0, daysInMonth }
    if (y < yr || (y === yr && m < mo)) return { day: daysInMonth, daysInMonth }
    return { day: now.getDate(), daysInMonth }
}

function statusColor(factPct: number, expectedPct: number): string {
    if (factPct <= 0 || expectedPct <= 0) return '#94a3b8'
    if (factPct >= expectedPct) return '#16a34a'
    if (factPct >= expectedPct * 0.7) return '#f59e0b'
    return '#ef4444'
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({
    factValue,
    planValue,
    expectedPct,
}: {
    factValue: number
    planValue: number
    expectedPct: number
}) {
    if (planValue === 0) return <div className="h-2 bg-slate-100 rounded-full" />
    const fillPct = Math.min((factValue / planValue) * 100, 100)
    const factPct = (factValue / planValue) * 100
    const color = statusColor(factPct, expectedPct)
    const markerPct = Math.min(expectedPct, 100)

    return (
        <div className="relative h-2 bg-slate-100 rounded-full overflow-visible">
            {fillPct > 0 && (
                <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${fillPct}%`, background: color, minWidth: 3 }}
                />
            )}
            {markerPct > 0 && markerPct < 100 && (
                <div
                    className="absolute z-10 rounded-sm"
                    style={{
                        left: `${markerPct}%`,
                        width: 2,
                        height: 16,
                        top: -7,
                        transform: 'translateX(-50%)',
                        background: '#94a3b8',
                        opacity: 0.5,
                    }}
                />
            )}
        </div>
    )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({
    factValue,
    planValue,
    expectedPct,
}: {
    factValue: number
    planValue: number
    expectedPct: number
}) {
    if (planValue === 0) return null
    const pct = Math.round((factValue / planValue) * 100)
    const factPct = (factValue / planValue) * 100
    const c = statusColor(factPct, expectedPct)

    return (
        <div
            className="inline-flex items-center justify-center text-xs font-semibold px-2 py-0.5 rounded-full min-w-10 tabular-nums"
            style={{ color: c, background: c + '1a' }}
        >
            {pct}%
        </div>
    )
}

// ─── KPI Summary Cards ────────────────────────────────────────────────────────

function KpiCard({
    label,
    value,
    sub,
    valueColor,
}: {
    label: string
    value: string
    sub?: string
    valueColor?: string
}) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
            <p className="text-xs font-medium text-slate-400 mb-1.5">{label}</p>
            <p
                className="text-xl font-bold tracking-tight leading-none"
                style={{ color: valueColor ?? '#0f172a' }}
            >
                {value}
            </p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
    )
}

function KpiSummaryCards({
 rows, period 
}: { rows: PlanFactRow[]; period: string }) {
    const expectedPct = getExpectedPct(period)
    const {
 day, daysInMonth 
} = getMonthProgress(period)

    const totalPlanRev = useMemo(
        () => rows.filter((r) => r.stat === 'REVENUE').reduce((s, r) => s + r.planValue, 0),
        [rows],
    )
    const totalFactRev = useMemo(
        () => rows.filter((r) => r.stat === 'REVENUE').reduce((s, r) => s + r.factValue, 0),
        [rows],
    )
    const totalFactMargin = useMemo(
        () => rows.filter((r) => r.stat === 'MARGIN').reduce((s, r) => s + r.factValue, 0),
        [rows],
    )
    const totalPlanMargin = useMemo(
        () => rows.filter((r) => r.stat === 'MARGIN').reduce((s, r) => s + r.planValue, 0),
        [rows],
    )

    const revPct = totalPlanRev > 0 ? Math.round((totalFactRev / totalPlanRev) * 100) : 0
    const marPct = totalPlanMargin > 0 ? Math.round((totalFactMargin / totalPlanMargin) * 100) : 0
    const revColor = statusColor(revPct, expectedPct)
    const marColor = statusColor(marPct, expectedPct)

    return (
        <div className="grid grid-cols-4 gap-3.5 mb-5">
            <KpiCard label="Выручка (план)" value={money(totalPlanRev)} />
            <KpiCard
                label="Выручка (факт)"
                value={money(totalFactRev)}
                sub={revPct > 0 ? `${revPct}% от плана` : undefined}
                valueColor={revPct > 0 ? revColor : undefined}
            />
            <KpiCard
                label="Маржа (факт)"
                value={money(totalFactMargin)}
                sub={marPct > 0 ? `${marPct}% от плана` : undefined}
                valueColor={marPct > 0 ? marColor : undefined}
            />
            <KpiCard
                label="Прогресс месяца"
                value={`${day} из ${daysInMonth} дней`}
                sub={`~${expectedPct}% ожидается`}
                valueColor="#3b82f6"
            />
        </div>
    )
}

// ─── PlanGroup ────────────────────────────────────────────────────────────────

interface PlanGroup {
    key: string
    scope: Scope
    employeeId: number | null
    departmentId: number | null
    entityName: string
    serviceRows: PlanFactRow[]
    shopRows: PlanFactRow[]
}

function groupRows(
    rows: PlanFactRow[],
    employees: Employee[],
    departments: Department[],
): PlanGroup[] {
    const empMap = new Map(employees.map((e) => [e.id, e]))
    const deptMap = new Map(departments.map((d) => [d.id, d]))
    const map = new Map<string, PlanGroup>()

    for (const row of rows) {
        let key: string
        let entityName: string

        if (row.scope === 'PERSONAL') {
            key = `PERSONAL-${row.employeeId}`
            const emp = empMap.get(row.employeeId!)
            entityName = emp ? `${emp.lastName} ${emp.firstName}` : `#${row.employeeId}`
        } else if (row.scope === 'DEPARTMENT') {
            key = `DEPARTMENT-${row.departmentId}`
            entityName = deptMap.get(row.departmentId!)?.name ?? `#${row.departmentId}`
        } else {
            key = 'COMPANY'
            entityName = 'Вся компания'
        }

        if (!map.has(key)) {
            map.set(key, {
                key,
                scope: row.scope,
                employeeId: row.employeeId,
                departmentId: row.departmentId,
                entityName,
                serviceRows: [],
                shopRows: [],
            })
        }
        const g = map.get(key)!
        if (row.direction === 'SERVICE') g.serviceRows.push(row)
        else g.shopRows.push(row)
    }

    return [...map.values()]
}

// ─── CategorySelect (для формы редактирования) ────────────────────────────────

function CategorySelect({
    direction,
    value,
    onChange,
}: {
    direction: Direction
    value: string
    onChange: (v: string) => void
}) {
    const {
 data: categories = [], isLoading 
} = useQuery(categoriesQuery(direction))
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 px-3 rounded-md border border-gray-200 text-sm min-w-48 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
            disabled={isLoading}
        >
            <option value="">Всё направление</option>
            {categories.map((c: CategoryNode) => (
                <option key={c.id} value={String(c.id)}>
                    {c.name}
                </option>
            ))}
        </select>
    )
}

// ─── PlanRowForm (inline edit) ────────────────────────────────────────────────

function PlanRowForm({
    period,
    scope,
    employees,
    departments,
    initial,
    onSuccess,
    onCancel,
}: {
    period: string
    scope: Scope
    employees: Employee[]
    departments: Department[]
    initial: PlanFactRow
    onSuccess: () => void
    onCancel: () => void
}) {
    const [direction, setDirection] = useState<Direction>(initial.direction)
    const [employeeId, setEmployeeId] = useState<number | null>(initial.employeeId)
    const [departmentId, setDepartmentId] = useState<number | null>(initial.departmentId)
    const [categoryExtId, setCategoryExtId] = useState(initial.categoryExtId ?? '')
    const [stat, setStat] = useState<KpiStat>(initial.stat)
    const [planValue, setPlanValue] = useState(String(initial.planValue))

    const {
 mutate, isPending 
} = useMutation({
        mutationFn: () =>
            salaryApi.updatePlanTarget(initial.id, {
                direction,
                scope,
                employeeId: scope === 'PERSONAL' ? employeeId : null,
                departmentId: scope === 'DEPARTMENT' ? departmentId : null,
                categoryExtId: categoryExtId || null,
                stat,
                planValue: Number(planValue),
            }),
        onSuccess: () => {
            toast.success('Строка плана обновлена')
            onSuccess()
        },
        onError: () => toast.error('Не удалось обновить план'),
    })

    const sel =
        'h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-amber-300'

    return (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50/60 mb-3">
            <select
                value={direction}
                onChange={(e) => {
                    setDirection(e.target.value as Direction)
                    setCategoryExtId('')
                }}
                className={sel}
            >
                <option value="SERVICE">Сервис</option>
                <option value="SHOP">Магазин</option>
            </select>
            {scope === 'PERSONAL' && (
                <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} />
            )}
            {scope === 'DEPARTMENT' && (
                <select
                    value={departmentId ?? ''}
                    onChange={(e) => setDepartmentId(Number(e.target.value))}
                    className={`${sel} min-w-48`}
                >
                    <option value="">Выберите отдел</option>
                    {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </select>
            )}
            <CategorySelect
                direction={direction}
                value={categoryExtId}
                onChange={setCategoryExtId}
            />
            <select
                value={stat}
                onChange={(e) => setStat(e.target.value as KpiStat)}
                className={sel}
            >
                {KPI_STATS.map((s) => (
                    <option key={s} value={s}>
                        {STAT_LABELS[s]}
                    </option>
                ))}
            </select>
            <input
                type="number"
                value={planValue}
                onChange={(e) => setPlanValue(e.target.value)}
                placeholder="План"
                className="h-9 px-3 rounded-md border border-gray-200 text-sm w-32 tabular-nums bg-white focus:outline-none focus:ring-1 focus:ring-amber-300"
            />
            <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={isPending}
                className="text-gray-500"
            >
                Отмена
            </Button>
            <Button
                size="sm"
                onClick={() => {
                    if (!planValue) {
                        toast.error('Укажите значение')
                        return
                    }
                    mutate()
                }}
                disabled={isPending}
            >
                Сохранить
            </Button>
        </div>
    )
}

// ─── DirectionSection ─────────────────────────────────────────────────────────

function DirectionSection({
    direction,
    rows,
    categoryNameMap,
    expectedPct,
    editingRowId,
    onEdit,
    onDelete,
}: {
    direction: Direction
    rows: PlanFactRow[]
    categoryNameMap: Map<string, string>
    expectedPct: number
    editingRowId: number | null
    onEdit: (row: PlanFactRow) => void
    onDelete: (id: number) => void
}) {
    const style = DIRECTION_STYLE[direction]

    const categoryGroups: [string | null, PlanFactRow[]][] = useMemo(() => {
        const map = new Map<string | null, PlanFactRow[]>()
        for (const row of rows) {
            const k = row.categoryExtId
            if (!map.has(k)) map.set(k, [])
            map.get(k)!.push(row)
        }
        return [...map.entries()]
    }, [rows])

    return (
        <div>
            {/* Direction header */}
            <div
                className="flex items-center px-5 py-2.5 border-b border-slate-100"
                style={{ background: style.bg }}
            >
                <span
                    className="text-xs font-semibold px-3 py-1 rounded-full"
                    style={{ color: style.color, background: style.tagBg }}
                >
                    {style.label}
                </span>
            </div>

            {/* Column headers */}
            <div
                className="grid items-center gap-3 px-5 py-2 border-b border-slate-100 bg-slate-50/60"
                style={{ gridTemplateColumns: COLS }}
            >
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                    Метрика
                </span>
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                    Прогресс
                </span>
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider text-right">
                    План
                </span>
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider text-right">
                    Факт
                </span>
                <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                    Вып.
                </span>
            </div>

            {/* Category groups */}
            {categoryGroups.map(([catId, catRows]) => (
                <div key={catId ?? '__all__'}>
                    {/* Category sub-header */}
                    <div className="flex items-center gap-2 px-5 py-1.5 bg-slate-50/80 border-b border-slate-100">
                        <div className="size-1 rounded-full bg-slate-300 shrink-0" />
                        <span className="text-[11px] font-medium text-slate-500">
                            {catId ? (categoryNameMap.get(catId) ?? catId) : 'Всё направление'}
                        </span>
                    </div>

                    {/* Metric rows */}
                    {catRows.map((row) => {
                        const factPct =
                            row.planValue > 0 ? (row.factValue / row.planValue) * 100 : 0
                        const c = statusColor(factPct, expectedPct)
                        const isEditing = editingRowId === row.id

                        return (
                            <div
                                key={row.id}
                                className={`relative group grid items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0 transition-colors ${
                                    isEditing ? 'bg-amber-50/60' : 'hover:bg-slate-50/60'
                                }`}
                                style={{ gridTemplateColumns: COLS }}
                            >
                                <span className="text-sm font-medium text-slate-700">
                                    {STAT_LABELS[row.stat] ?? row.stat}
                                </span>
                                <ProgressBar
                                    factValue={row.factValue}
                                    planValue={row.planValue}
                                    expectedPct={expectedPct}
                                />
                                <span className="text-sm text-slate-500 text-right tabular-nums">
                                    {money(row.planValue)}
                                </span>
                                <span
                                    className="text-sm text-right tabular-nums"
                                    style={{
                                        fontWeight: row.factValue > 0 ? 600 : 400,
                                        color: row.factValue > 0 ? c : '#cbd5e1',
                                    }}
                                >
                                    {money(row.factValue)}
                                </span>
                                <div className="flex justify-center">
                                    <StatusBadge
                                        factValue={row.factValue}
                                        planValue={row.planValue}
                                        expectedPct={expectedPct}
                                    />
                                </div>

                                {/* Hover actions */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => onEdit(row)}
                                        className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-600"
                                    >
                                        <Pencil className="size-3.5" />
                                    </button>
                                    <button
                                        onClick={() => onDelete(row.id)}
                                        className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({
    group,
    period,
    expectedPct,
    employees,
    departments,
    categoryNameMap,
    editingRow,
    onEdit,
    onDelete,
    onEditSuccess,
    onEditCancel,
}: {
    group: PlanGroup
    period: string
    expectedPct: number
    employees: Employee[]
    departments: Department[]
    categoryNameMap: Map<string, string>
    editingRow: PlanFactRow | null
    onEdit: (row: PlanFactRow) => void
    onDelete: (id: number) => void
    onEditSuccess: () => void
    onEditCancel: () => void
}) {
    const isEditing =
        editingRow !== null &&
        editingRow.scope === group.scope &&
        editingRow.employeeId === group.employeeId &&
        editingRow.departmentId === group.departmentId

    const editingRowId = isEditing ? editingRow!.id : null
    const scopeLabel =
        group.scope === 'PERSONAL'
            ? 'Сотрудник'
            : group.scope === 'DEPARTMENT'
              ? 'Отдел'
              : 'Компания'
    const ScopeIcon = group.scope === 'PERSONAL' ? User : Building2

    return (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* Card header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className={`flex items-center justify-center size-9 rounded-xl border shrink-0 ${
                            group.scope === 'PERSONAL'
                                ? 'bg-slate-50 border-slate-200'
                                : 'bg-slate-50 border-slate-200'
                        }`}
                    >
                        <ScopeIcon className="size-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm leading-tight truncate">
                            {group.entityName}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{scopeLabel}</p>
                    </div>
                </div>
                <p className="text-sm text-slate-400 font-medium shrink-0 capitalize">
                    {fmtPeriod(period)}
                </p>
            </div>

            {/* Inline edit form */}
            {isEditing && (
                <div className="px-5 pt-4">
                    <PlanRowForm
                        period={period}
                        scope={editingRow!.scope}
                        employees={employees}
                        departments={departments}
                        initial={editingRow!}
                        onSuccess={onEditSuccess}
                        onCancel={onEditCancel}
                    />
                </div>
            )}

            {/* Direction sections */}
            <div className="divide-y divide-slate-100">
                {group.serviceRows.length > 0 && (
                    <DirectionSection
                        direction="SERVICE"
                        rows={group.serviceRows}
                        categoryNameMap={categoryNameMap}
                        expectedPct={expectedPct}
                        editingRowId={editingRowId}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                )}
                {group.shopRows.length > 0 && (
                    <DirectionSection
                        direction="SHOP"
                        rows={group.shopRows}
                        categoryNameMap={categoryNameMap}
                        expectedPct={expectedPct}
                        editingRowId={editingRowId}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                )}
            </div>
        </div>
    )
}

// ─── PlanFactView ─────────────────────────────────────────────────────────────

export function PlanFactView() {
    const [period, setPeriod] = useState(currentPeriod())
    const [entityFilter, setEntityFilter] = useState<EntityFilter>('all')
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [editingRow, setEditingRow] = useState<PlanFactRow | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const queryClient = useQueryClient()

    const { data: employees = [] } = useQuery(employeesQuery)
    const { data: departments = [] } = useQuery(departmentsQuery)

    const queryParams = {
        period,
        scope:
            entityFilter === 'employee'
                ? ('PERSONAL' as Scope)
                : entityFilter === 'department'
                  ? ('DEPARTMENT' as Scope)
                  : undefined,
        employeeIds:
            entityFilter === 'employee' && selectedIds.length > 0 ? selectedIds : undefined,
        departmentIds:
            entityFilter === 'department' && selectedIds.length > 0 ? selectedIds : undefined,
    }

    const {
 data: rows = [], isLoading, isError 
} = useQuery(planFactQuery(queryParams))
    const queryKey = planFactQuery(queryParams).queryKey

    const { data: serviceCategories = [] } = useQuery(categoriesQuery('SERVICE'))
    const { data: shopCategories = [] } = useQuery(categoriesQuery('SHOP'))
    const categoryNameMap = useMemo(() => {
        const map = new Map<string, string>()
        for (const c of serviceCategories) map.set(String(c.id), c.name)
        for (const c of shopCategories) map.set(String(c.id), c.name)
        return map
    }, [serviceCategories, shopCategories])

    const groups = useMemo(
        () => groupRows(rows, employees, departments),
        [rows, employees, departments],
    )
    const expectedPct = useMemo(() => getExpectedPct(period), [period])

    const { mutate: deletePlanTarget } = useMutation({
        mutationFn: (id: number) => salaryApi.deletePlanTarget(id),
        onSuccess: (_, id) => {
            toast.success('Строка плана удалена')
            queryClient.setQueryData(queryKey, (prev: PlanFactRow[] | undefined) =>
                prev?.filter((r) => r.id !== id),
            )
        },
        onError: () => toast.error('Не удалось удалить строку плана'),
    })

    const employeeOptions = employees.map((e) => ({
        id: e.id,
        label: `${e.lastName} ${e.firstName}`,
    }))
    const departmentOptions = departments.map((d) => ({ id: d.id, label: d.name }))

    const selectCls =
        'h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300'

    return (
        <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                <div>
                    <h2 className="text-[22px] font-bold text-slate-900 tracking-tight leading-none mb-1">
                        План / Факт
                    </h2>
                    {!isLoading && (
                        <span className="text-sm text-slate-400">
                            {groups.length}{' '}
                            {groups.length === 1 ? 'план' : groups.length < 5 ? 'плана' : 'планов'}{' '}
                            · <span className="capitalize">{fmtPeriod(period)}</span>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                    <MonthPicker value={period} onChange={setPeriod} />
                    <select
                        value={entityFilter}
                        onChange={(e) => {
                            setEntityFilter(e.target.value as EntityFilter)
                            setSelectedIds([])
                        }}
                        className={selectCls}
                    >
                        <option value="all">Все</option>
                        <option value="employee">Сотрудники</option>
                        <option value="department">Отделы</option>
                    </select>
                    {entityFilter === 'employee' && (
                        <MultiSelect
                            options={employeeOptions}
                            selected={selectedIds}
                            onChange={(ids) => setSelectedIds(ids.map(Number))}
                            placeholder="Все сотрудники"
                        />
                    )}
                    {entityFilter === 'department' && (
                        <MultiSelect
                            options={departmentOptions}
                            selected={selectedIds}
                            onChange={(ids) => setSelectedIds(ids.map(Number))}
                            placeholder="Все отделы"
                        />
                    )}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors"
                    >
                        <Plus className="size-3.5" />
                        Создать план
                    </button>
                </div>
            </div>

            {isError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
                    Не удалось загрузить план/факт
                </div>
            )}

            {!isError &&
                (isLoading ? (
                    <p className="text-sm text-slate-400 text-center py-16">Загрузка…</p>
                ) : groups.length === 0 ? (
                    <div className="flex flex-col items-center py-16">
                        <p className="text-slate-400 text-sm mb-3">Планов за этот период нет</p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            <Plus className="size-3.5" />
                            Создать план
                        </button>
                    </div>
                ) : (
                    <>
                        <KpiSummaryCards rows={rows} period={period} />
                        <div className="flex flex-col gap-4">
                            {groups.map((group) => (
                                <PlanCard
                                    key={group.key}
                                    group={group}
                                    period={period}
                                    expectedPct={expectedPct}
                                    employees={employees}
                                    departments={departments}
                                    categoryNameMap={categoryNameMap}
                                    editingRow={editingRow}
                                    onEdit={setEditingRow}
                                    onDelete={deletePlanTarget}
                                    onEditSuccess={() => {
                                        setEditingRow(null)
                                        queryClient.invalidateQueries({ queryKey })
                                    }}
                                    onEditCancel={() => setEditingRow(null)}
                                />
                            ))}
                        </div>
                    </>
                ))}

            {isModalOpen && (
                <CreatePlanModal
                    period={period}
                    existingRows={rows}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </>
    )
}
