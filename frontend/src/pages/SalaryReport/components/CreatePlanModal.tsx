import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, X, GripVertical } from 'lucide-react'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/shared/ui/button'
import { salaryApi } from '../api'
import { employeesQuery, departmentsQuery, categoriesQuery } from '../queries'
import { EmployeeSelect } from './EmployeeSelect'
import { MultiSelect } from './MultiSelect'
import type { Direction, KpiStat, PlanFactRow, Scope } from '../types'

const STAT_LABELS: Record<KpiStat, string> = {
    REVENUE: 'Выручка',
    MARGIN: 'Маржа',
    MARGIN_MINUS_ENGINEER: 'Маржа−инженер',
    PCS: 'Шт.',
    COSTS: 'Затраты',
}

const ALL_STATS: KpiStat[] = ['REVENUE', 'MARGIN', 'MARGIN_MINUS_ENGINEER', 'PCS', 'COSTS']

type EntityType = 'employee' | 'department'

interface MetricRow {
    stat: KpiStat
    value: string
}

interface CategoryEntry {
    id: string
    name: string
    metrics: MetricRow[]
}

interface DirectionBlock {
    localId: string
    direction: Direction
    allDirection: boolean
    allDirectionMetrics: MetricRow[]
    entries: CategoryEntry[]
}

// ─── MetricsEditor (shared) ───────────────────────────────────────────────────

function MetricsEditor({
    metrics,
    onUpdate,
}: {
    metrics: MetricRow[]
    onUpdate: (m: MetricRow[]) => void
}) {
    const inputCls =
        'h-8 px-2.5 rounded-md border border-gray-200 text-sm w-32 tabular-nums bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400'
    const selectCls =
        'h-8 px-2 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400'

    function update(idx: number, field: 'stat' | 'value', val: string) {
        onUpdate(metrics.map((m, i) => (i !== idx ? m : { ...m, [field]: val })))
    }

    function remove(idx: number) {
        onUpdate(metrics.filter((_, i) => i !== idx))
    }

    function add() {
        const used = metrics.map((m) => m.stat)
        const next = ALL_STATS.find((s) => !used.includes(s))
        if (next) onUpdate([...metrics, { stat: next, value: '' }])
    }

    return (
        <div className="space-y-1.5">
            {metrics.map((m, mi) => (
                <div key={mi} className="flex items-center gap-2">
                    <select
                        value={m.stat}
                        onChange={(e) => update(mi, 'stat', e.target.value)}
                        className={selectCls}
                    >
                        {ALL_STATS.map((s) => (
                            <option key={s} value={s}>
                                {STAT_LABELS[s]}
                            </option>
                        ))}
                    </select>
                    <input
                        type="number"
                        value={m.value}
                        onChange={(e) => update(mi, 'value', e.target.value)}
                        placeholder="Значение"
                        className={inputCls}
                    />
                    <button
                        onClick={() => remove(mi)}
                        className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
            ))}
            {metrics.length < ALL_STATS.length && (
                <button
                    onClick={add}
                    className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
                >
                    <Plus className="size-3" />
                    Добавить метрику
                </button>
            )}
        </div>
    )
}

// ─── SortableCategoryEntry ────────────────────────────────────────────────────

function SortableCategoryEntry({
    entry,
    onUpdateMetrics,
}: {
    entry: CategoryEntry
    onUpdateMetrics: (metrics: MetricRow[]) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: entry.id,
    })

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div ref={setNodeRef} style={style} className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
                <button
                    {...attributes}
                    {...listeners}
                    className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
                    tabIndex={-1}
                >
                    <GripVertical className="size-3.5" />
                </button>
                <p className="text-xs font-medium text-gray-700 truncate">{entry.name}</p>
            </div>
            <div className="pl-5">
                <MetricsEditor metrics={entry.metrics} onUpdate={onUpdateMetrics} />
            </div>
        </div>
    )
}

// ─── CategoryEntriesEditor ────────────────────────────────────────────────────

function CategoryEntriesEditor({
    entries,
    onUpdate,
}: {
    entries: CategoryEntry[]
    onUpdate: (entries: CategoryEntry[]) => void
}) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (over && active.id !== over.id) {
            const oldIdx = entries.findIndex((e) => e.id === active.id)
            const newIdx = entries.findIndex((e) => e.id === over.id)
            onUpdate(arrayMove(entries, oldIdx, newIdx))
        }
    }

    function updateMetrics(catId: string, metrics: MetricRow[]) {
        onUpdate(entries.map((e) => (e.id !== catId ? e : { ...e, metrics })))
    }

    if (entries.length === 0) {
        return <p className="text-xs text-gray-400 py-2">Выберите категории выше</p>
    }

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
                items={entries.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="mt-2 border border-gray-100 rounded-lg overflow-hidden divide-y divide-gray-100">
                    {entries.map((entry) => (
                        <SortableCategoryEntry
                            key={entry.id}
                            entry={entry}
                            onUpdateMetrics={(m) => updateMetrics(entry.id, m)}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    )
}

// ─── DirectionBlockEditor ─────────────────────────────────────────────────────

function DirectionBlockEditor({
    block,
    onUpdate,
    onRemove,
    canRemove,
}: {
    block: DirectionBlock
    onUpdate: (b: DirectionBlock) => void
    onRemove: () => void
    canRemove: boolean
}) {
    const { data: categories = [], isLoading } = useQuery(categoriesQuery(block.direction))

    const categoryOptions = categories.map((c) => ({ id: String(c.id), label: c.name }))
    const selectedCategoryIds = block.entries.map((e) => e.id)

    function handleDirectionChange(dir: Direction) {
        onUpdate({ ...block, direction: dir, entries: [] })
    }

    function handleAllDirectionToggle(checked: boolean) {
        onUpdate({
            ...block,
            allDirection: checked,
            entries: [],
            allDirectionMetrics: checked ? [...DEFAULT_METRICS] : block.allDirectionMetrics,
        })
    }

    function handleCategoryToggle(ids: (number | string)[]) {
        const strIds = ids.map(String)
        const catMap = new Map(categories.map((c) => [String(c.id), c.name]))
        const entries = [
            ...block.entries.filter((e) => strIds.includes(e.id)),
            ...strIds
                .filter((id) => !block.entries.some((e) => e.id === id))
                .map((id) => ({
                    id,
                    name: catMap.get(id) ?? id,
                    metrics: [...DEFAULT_METRICS],
                })),
        ]
        onUpdate({ ...block, entries })
    }

    return (
        <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/40">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
                <select
                    value={block.direction}
                    onChange={(e) => handleDirectionChange(e.target.value as Direction)}
                    className="h-8 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                    <option value="SERVICE">Сервис</option>
                    <option value="SHOP">Магазин</option>
                </select>

                <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={block.allDirection}
                        onChange={(e) => handleAllDirectionToggle(e.target.checked)}
                        className="size-3.5 rounded accent-emerald-500"
                    />
                    Всё направление
                </label>

                {!block.allDirection && (
                    <MultiSelect
                        options={categoryOptions}
                        selected={selectedCategoryIds}
                        onChange={handleCategoryToggle}
                        placeholder={isLoading ? 'Загрузка…' : 'Выбрать категории'}
                    />
                )}

                {canRemove && (
                    <button
                        onClick={onRemove}
                        className="ml-auto p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                        title="Удалить блок"
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                )}
            </div>

            {block.allDirection ? (
                <div className="mt-1 border border-gray-100 rounded-lg px-3 py-2.5">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Метрики для всего направления</p>
                    <MetricsEditor
                        metrics={block.allDirectionMetrics}
                        onUpdate={(m) => onUpdate({ ...block, allDirectionMetrics: m })}
                    />
                </div>
            ) : (
                <CategoryEntriesEditor
                    entries={block.entries}
                    onUpdate={(entries) => onUpdate({ ...block, entries })}
                />
            )}
        </div>
    )
}

// ─── CreatePlanModal ──────────────────────────────────────────────────────────

let blockCounter = 0
const DEFAULT_METRICS: MetricRow[] = [
    { stat: 'REVENUE', value: '' },
    { stat: 'MARGIN', value: '' },
]

function newBlock(direction: Direction = 'SERVICE'): DirectionBlock {
    return {
        localId: `block-${++blockCounter}`,
        direction,
        allDirection: false,
        allDirectionMetrics: [...DEFAULT_METRICS],
        entries: [],
    }
}

interface Props {
    period: string
    existingRows: PlanFactRow[]
    onClose: () => void
}

export function CreatePlanModal({ period, existingRows, onClose }: Props) {
    const { data: employees = [] } = useQuery(employeesQuery)
    const { data: departments = [] } = useQuery(departmentsQuery)

    const [entityType, setEntityType] = useState<EntityType>('employee')
    const [entityId, setEntityId] = useState<number | null>(null)
    const [blocks, setBlocks] = useState<DirectionBlock[]>([newBlock()])

    const queryClient = useQueryClient()

    const { mutate, isPending } = useMutation({
        mutationFn: () => {
            if (!entityId) return Promise.reject(new Error('no-entity'))

            const duplicate = existingRows.some((row) =>
                entityType === 'employee'
                    ? row.scope === 'PERSONAL' && row.employeeId === entityId
                    : row.scope === 'DEPARTMENT' && row.departmentId === entityId,
            )
            if (duplicate) return Promise.reject(new Error('duplicate'))
            const scope: Scope = entityType === 'employee' ? 'PERSONAL' : 'DEPARTMENT'

            const items = blocks.flatMap((b) => {
                const base = {
                    period,
                    direction: b.direction,
                    scope,
                    employeeId: entityType === 'employee' ? entityId : undefined,
                    departmentId: entityType === 'department' ? entityId : undefined,
                }
                if (b.allDirection) {
                    return b.allDirectionMetrics.map((m) => ({
                        ...base,
                        categoryExtId: undefined,
                        stat: m.stat,
                        planValue: Number(m.value) || 0,
                    }))
                }
                return b.entries.flatMap((e) =>
                    e.metrics.map((m) => ({
                        ...base,
                        categoryExtId: e.id,
                        stat: m.stat,
                        planValue: Number(m.value) || 0,
                    })),
                )
            })

            if (items.length === 0) return Promise.reject(new Error('empty'))
            return salaryApi.bulkCreatePlanTargets(items)
        },
        onSuccess: () => {
            toast.success('План создан')
            queryClient.invalidateQueries({ queryKey: ['salary', 'plan-fact'] })
            onClose()
        },
        onError: (e: Error) => {
            if (e.message === 'no-entity') toast.error('Выберите сотрудника или отдел')
            else if (e.message === 'duplicate') toast.error('План на этот месяц уже существует')
            else if (e.message === 'empty') toast.error('Добавьте хотя бы одну категорию или выберите «Всё направление»')
            else toast.error('Не удалось создать план')
        },
    })

    const selectCls =
        'h-9 px-3 rounded-md border border-gray-200 text-sm bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 min-w-56'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                    <h2 className="text-base font-semibold text-gray-900">Создать новый план</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    {/* Entity type */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                            Цель плана
                        </p>
                        <div className="flex gap-4 mb-3">
                            {(['employee', 'department'] as const).map((type) => (
                                <label key={type} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="entityType"
                                        value={type}
                                        checked={entityType === type}
                                        onChange={() => {
                                            setEntityType(type)
                                            setEntityId(null)
                                        }}
                                        className="accent-emerald-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                        {type === 'employee' ? 'Сотрудник' : 'Отдел'}
                                    </span>
                                </label>
                            ))}
                        </div>
                        {entityType === 'employee' ? (
                            <EmployeeSelect
                                employees={employees}
                                value={entityId}
                                onChange={setEntityId}
                                placeholder="Выберите сотрудника"
                            />
                        ) : (
                            <select
                                value={entityId ?? ''}
                                onChange={(e) => setEntityId(Number(e.target.value))}
                                className={selectCls}
                            >
                                <option value="">Выберите отдел</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Direction blocks */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                            Направления и категории
                        </p>
                        <div className="space-y-2">
                            {blocks.map((block) => (
                                <DirectionBlockEditor
                                    key={block.localId}
                                    block={block}
                                    onUpdate={(updated) =>
                                        setBlocks((prev) =>
                                            prev.map((b) => (b.localId === block.localId ? updated : b)),
                                        )
                                    }
                                    onRemove={() =>
                                        setBlocks((prev) => prev.filter((b) => b.localId !== block.localId))
                                    }
                                    canRemove={blocks.length > 1}
                                />
                            ))}
                        </div>
                        <button
                            onClick={() => setBlocks((prev) => [...prev, newBlock()])}
                            className="mt-2.5 flex items-center gap-1.5 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
                        >
                            <Plus className="size-3.5" />
                            Добавить направление
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
                    <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
                        Отмена
                    </Button>
                    <Button size="sm" onClick={() => mutate()} disabled={isPending}>
                        {isPending ? 'Создаём…' : 'Создать план'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
