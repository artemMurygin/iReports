import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { salaryApi } from '../api'
import { employeesQuery, departmentsQuery, planFactQuery, categoriesQuery } from '../queries'
import { EmployeeSelect } from './EmployeeSelect'
import { MultiSelect } from './MultiSelect'
import { CreatePlanModal } from './CreatePlanModal'
import { MonthPicker } from '@/shared/ui/month-picker'
import { currentPeriod } from '../utils/period'
import { money } from '../utils/format'
import type { CategoryNode, Department, Direction, Employee, KpiStat, PlanFactRow, Scope } from '../types'

const KPI_STATS: KpiStat[] = ['REVENUE', 'MARGIN', 'MARGIN_MINUS_ENGINEER', 'PCS', 'COSTS']

const STAT_LABELS: Record<KpiStat, string> = {
    REVENUE: 'Выручка',
    MARGIN: 'Маржа',
    MARGIN_MINUS_ENGINEER: 'Маржа−инженер',
    PCS: 'Шт.',
    COSTS: 'Затраты',
}

const DIRECTION_LABEL: Record<Direction, string> = {
    SERVICE: 'Сервис',
    SHOP: 'Магазин',
}

type EntityFilter = 'all' | 'employee' | 'department'

function FulfillmentBadge({ planValue, factValue }: { planValue: number; factValue: number }) {
    if (planValue === 0) return null
    const pct = Math.round((factValue / planValue) * 100)
    const cls =
        pct >= 100
            ? 'bg-emerald-100 text-emerald-700'
            : pct >= 70
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full tabular-nums font-medium ${cls}`}>
            {pct}%
        </span>
    )
}

// ─── CategorySelect ───────────────────────────────────────────────────────────

function CategorySelect({
    direction,
    value,
    onChange,
}: {
    direction: Direction
    value: string
    onChange: (v: string) => void
}) {
    const { data: categories = [], isLoading } = useQuery(categoriesQuery(direction))

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

interface PlanRowFormProps {
    period: string
    scope: Scope
    employees: Employee[]
    departments: Department[]
    initial: PlanFactRow
    onSuccess: () => void
    onCancel: () => void
}

function PlanRowForm({ period, scope, employees, departments, initial, onSuccess, onCancel }: PlanRowFormProps) {
    const [direction, setDirection] = useState<Direction>(initial.direction)
    const [employeeId, setEmployeeId] = useState<number | null>(initial.employeeId)
    const [departmentId, setDepartmentId] = useState<number | null>(initial.departmentId)
    const [categoryExtId, setCategoryExtId] = useState(initial.categoryExtId ?? '')
    const [stat, setStat] = useState<KpiStat>(initial.stat)
    const [planValue, setPlanValue] = useState(String(initial.planValue))

    const { mutate, isPending } = useMutation({
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

    function handleSave() {
        if (!planValue) {
            toast.error('Укажите значение плана')
            return
        }
        mutate()
    }

    const selectCls =
        'h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300'

    return (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50/60">
            <select
                value={direction}
                onChange={(e) => {
                    setDirection(e.target.value as Direction)
                    setCategoryExtId('')
                }}
                className={selectCls}
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
                    className={`${selectCls} min-w-48`}
                >
                    <option value="">Выберите отдел</option>
                    {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </select>
            )}

            <CategorySelect direction={direction} value={categoryExtId} onChange={setCategoryExtId} />

            <select
                value={stat}
                onChange={(e) => setStat(e.target.value as KpiStat)}
                className={selectCls}
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
                className="h-9 px-3 rounded-md border border-gray-200 text-sm w-32 tabular-nums bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
            />

            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending} className="text-gray-500">
                Отмена
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
                Сохранить
            </Button>
        </div>
    )
}

// ─── PlanFactRowItem ──────────────────────────────────────────────────────────

function PlanFactRowItem({
    row,
    employees,
    departments,
    categoryNameMap,
    onEdit,
    onDelete,
}: {
    row: PlanFactRow
    employees: Employee[]
    departments: Department[]
    categoryNameMap: Map<string, string>
    onEdit: (row: PlanFactRow) => void
    onDelete: (id: number) => void
}) {
    function entityLabel() {
        if (row.scope === 'PERSONAL') {
            const e = employees.find((emp) => emp.id === row.employeeId)
            return e ? `${e.lastName} ${e.firstName}` : row.employeeId ? `#${row.employeeId}` : '—'
        }
        if (row.scope === 'DEPARTMENT') {
            return (
                departments.find((d) => d.id === row.departmentId)?.name ??
                (row.departmentId ? `#${row.departmentId}` : '—')
            )
        }
        return 'Вся компания'
    }

    return (
        <TableRow className="group hover:bg-gray-50/80 transition-colors">
            <TableCell>
                <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        row.direction === 'SERVICE'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-violet-100 text-violet-700'
                    }`}
                >
                    {DIRECTION_LABEL[row.direction]}
                </span>
            </TableCell>
            <TableCell className="text-sm font-medium text-gray-900">{entityLabel()}</TableCell>
            <TableCell className="text-sm text-gray-500">
                {row.categoryExtId
                    ? (categoryNameMap.get(row.categoryExtId) ?? row.categoryExtId)
                    : '—'}
            </TableCell>
            <TableCell className="text-sm text-gray-600">{STAT_LABELS[row.stat] ?? row.stat}</TableCell>
            <TableCell className="text-right tabular-nums text-sm text-gray-900 font-medium">
                {money(row.planValue)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm text-gray-600">
                {money(row.factValue)}
            </TableCell>
            <TableCell className="text-right">
                <FulfillmentBadge planValue={row.planValue} factValue={row.factValue} />
            </TableCell>
            <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(row)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        title="Редактировать"
                    >
                        <Pencil className="size-3.5" />
                    </button>
                    <button
                        onClick={() => onDelete(row.id)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                        title="Удалить"
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                </div>
            </TableCell>
        </TableRow>
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
        employeeIds: entityFilter === 'employee' && selectedIds.length > 0 ? selectedIds : undefined,
        departmentIds: entityFilter === 'department' && selectedIds.length > 0 ? selectedIds : undefined,
    }

    const { data: rows = [], isLoading, isError } = useQuery(planFactQuery(queryParams))
    const queryKey = planFactQuery(queryParams).queryKey

    const { data: serviceCategories = [] } = useQuery(categoriesQuery('SERVICE'))
    const { data: shopCategories = [] } = useQuery(categoriesQuery('SHOP'))
    const categoryNameMap = useMemo(() => {
        const map = new Map<string, string>()
        for (const c of serviceCategories) map.set(String(c.id), c.name)
        for (const c of shopCategories) map.set(String(c.id), c.name)
        return map
    }, [serviceCategories, shopCategories])

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

    function handleEntityFilterChange(filter: EntityFilter) {
        setEntityFilter(filter)
        setSelectedIds([])
    }

    const entityFilterLabel =
        entityFilter === 'employee'
            ? 'Сотрудник'
            : entityFilter === 'department'
              ? 'Отдел'
              : 'Сущность'

    const selectCls =
        'h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300'

    return (
        <>
            <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div>
                            <CardTitle className="text-xl font-extrabold text-gray-900 tracking-tight">
                                План / Факт
                            </CardTitle>
                            {!isLoading && (
                                <p className="mt-0.5 text-sm text-gray-500">
                                    {rows.length}{' '}
                                    {rows.length === 1
                                        ? 'строка'
                                        : rows.length < 5
                                          ? 'строки'
                                          : 'строк'}{' '}
                                    · {period}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <MonthPicker value={period} onChange={setPeriod} />

                            <select
                                value={entityFilter}
                                onChange={(e) => handleEntityFilterChange(e.target.value as EntityFilter)}
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

                            <Button size="sm" onClick={() => setIsModalOpen(true)}>
                                <Plus className="size-3.5" />
                                Создать план
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {editingRow && (
                        <div className="p-4 border-b border-gray-100">
                            <PlanRowForm
                                period={period}
                                scope={editingRow.scope}
                                employees={employees}
                                departments={departments}
                                initial={editingRow}
                                onSuccess={() => {
                                    setEditingRow(null)
                                    queryClient.invalidateQueries({ queryKey })
                                }}
                                onCancel={() => setEditingRow(null)}
                            />
                        </div>
                    )}

                    {isError && (
                        <div className="m-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                            Не удалось загрузить план/факт
                        </div>
                    )}

                    {!isError &&
                        (isLoading ? (
                            <p className="text-sm text-gray-400 text-center py-10">Загрузка…</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead className="font-bold text-gray-700">Направление</TableHead>
                                        <TableHead className="font-bold text-gray-700">
                                            {entityFilterLabel}
                                        </TableHead>
                                        <TableHead className="font-bold text-gray-700">Категория</TableHead>
                                        <TableHead className="font-bold text-gray-700">Метрика</TableHead>
                                        <TableHead className="text-right font-bold text-gray-700">
                                            План
                                        </TableHead>
                                        <TableHead className="text-right font-bold text-gray-700">
                                            Факт
                                        </TableHead>
                                        <TableHead className="text-right font-bold text-gray-700">
                                            Выполнение
                                        </TableHead>
                                        <TableHead className="w-16" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row) => (
                                        <PlanFactRowItem
                                            key={row.id}
                                            row={row}
                                            employees={employees}
                                            departments={departments}
                                            categoryNameMap={categoryNameMap}
                                            onEdit={setEditingRow}
                                            onDelete={deletePlanTarget}
                                        />
                                    ))}
                                    {rows.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={8}
                                                className="text-center text-sm text-gray-400 py-10"
                                            >
                                                Нет строк плана — нажмите «Создать план»
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        ))}
                </CardContent>
            </Card>

            {isModalOpen && (
                <CreatePlanModal period={period} onClose={() => setIsModalOpen(false)} />
            )}
        </>
    )
}
