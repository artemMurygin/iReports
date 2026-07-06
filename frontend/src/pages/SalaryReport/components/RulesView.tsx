import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { salaryApi } from '../api'
import { rulesQuery, employeesQuery, departmentsQuery } from '../queries'
import { EmployeeSelect } from './EmployeeSelect'
import { GoalForm } from './GoalForm'
import { money } from '../utils/format'
import type { Department, Employee, Goal, RuleStatus, SalaryRule } from '../types'

// ─── CreateRuleForm ───────────────────────────────────────────────────────────

interface CreateRuleFormProps {
    employees: Employee[]
    departments: Department[]
    onSuccess: () => void
    onCancel: () => void
}

function CreateRuleForm({
 employees, departments, onSuccess, onCancel 
}: CreateRuleFormProps) {
    const [name, setName] = useState('')
    const [payPerHour, setPayPerHour] = useState('')
    const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10))
    const [assignTarget, setAssignTarget] = useState<'employee' | 'department'>('employee')
    const [employeeId, setEmployeeId] = useState<number | null>(null)
    const [departmentId, setDepartmentId] = useState<number | null>(null)

    const {
 mutate, isPending 
} = useMutation({
        mutationFn: () => {
            const assignment =
                assignTarget === 'employee'
                    ? { employeeId: employeeId ?? undefined }
                    : { departmentId: departmentId ?? undefined }
            return salaryApi.createRule({
                name,
                payPerHour: payPerHour ? Number(payPerHour) : undefined,
                validFrom,
                isRegular: true,
                assignments: [assignment],
            })
        },
        onSuccess: () => {
            toast.success('Правило создано')
            onSuccess()
        },
        onError: () => toast.error('Не удалось создать правило'),
    })

    function handleCreate() {
        if (!name.trim()) {
            toast.error('Укажите название правила')
            return
        }
        const hasAssignment = assignTarget === 'employee' ? !!employeeId : !!departmentId
        if (!hasAssignment) {
            toast.error('Выберите сотрудника или отдел')
            return
        }
        mutate()
    }

    return (
        <Card>
            <CardContent className="flex flex-col gap-3 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Название правила"
                        className="h-9 px-3 rounded border border-gray-200 text-sm flex-1 min-w-48"
                    />
                    <input
                        type="number"
                        value={payPerHour}
                        onChange={(e) => setPayPerHour(e.target.value)}
                        placeholder="Ставка/час, ₽ (опц.)"
                        className="h-9 px-3 rounded border border-gray-200 text-sm w-44 tabular-nums"
                    />
                    <input
                        type="date"
                        value={validFrom}
                        onChange={(e) => setValidFrom(e.target.value)}
                        className="h-9 px-3 rounded border border-gray-200 text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={assignTarget}
                        onChange={(e) =>
                            setAssignTarget(e.target.value as 'employee' | 'department')
                        }
                        className="h-9 px-3 rounded border border-gray-200 text-sm"
                    >
                        <option value="employee">Сотрудник</option>
                        <option value="department">Отдел</option>
                    </select>
                    {assignTarget === 'employee' ? (
                        <EmployeeSelect
                            employees={employees}
                            value={employeeId}
                            onChange={setEmployeeId}
                        />
                    ) : (
                        <select
                            value={departmentId ?? ''}
                            onChange={(e) => setDepartmentId(Number(e.target.value))}
                            className="h-9 px-3 rounded border border-gray-200 text-sm min-w-48"
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
                <div className="flex items-center gap-2 self-end">
                    <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
                        Отмена
                    </Button>
                    <Button size="sm" onClick={handleCreate} disabled={isPending}>
                        Создать
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

// ─── PayPerHourEditor ─────────────────────────────────────────────────────────

interface PayPerHourEditorProps {
    rule: SalaryRule
    onSaved: () => void
}

function PayPerHourEditor({
 rule, onSaved 
}: PayPerHourEditorProps) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState('')

    const {
 mutate, isPending 
} = useMutation({
        mutationFn: () =>
            salaryApi.updateRule(rule.id, {
                payPerHour: draft.trim() === '' ? null : Number(draft),
            }),
        onSuccess: () => {
            toast.success('Ставка обновлена')
            setEditing(false)
            onSaved()
        },
        onError: () => toast.error('Не удалось обновить ставку'),
    })

    if (editing) {
        return (
            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                    autoFocus
                    type="number"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') mutate()
                        if (e.key === 'Escape') setEditing(false)
                    }}
                    placeholder="ставка"
                    className="h-6 w-24 px-2 rounded border border-gray-200 text-xs tabular-nums"
                />
                <span className="text-gray-400">₽/час</span>
                <Button variant="ghost" size="xs" onClick={() => mutate()} disabled={isPending}>
                    ОК
                </Button>
                <Button variant="ghost" size="xs" onClick={() => setEditing(false)}>
                    ✕
                </Button>
            </span>
        )
    }

    return (
        <span
            className="cursor-pointer hover:text-gray-600 hover:underline decoration-dashed underline-offset-2"
            onClick={(e) => {
                e.stopPropagation()
                setDraft(rule.payPerHour != null ? String(rule.payPerHour) : '')
                setEditing(true)
            }}
        >
            {rule.payPerHour != null ? `${money(rule.payPerHour)}/час` : '+ ставка'}
        </span>
    )
}

// ─── GoalRow ──────────────────────────────────────────────────────────────────

interface GoalRowProps {
    goal: Goal
    onEdit: (goal: Goal) => void
    onDelete: (goalId: number) => void
}

function GoalRow({
 goal, onEdit, onDelete 
}: GoalRowProps) {
    return (
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-gray-50 text-sm group">
            <span>
                {goal.name}
                <span className="text-gray-400 ml-2">
                    {goal.type} · {goal.direction} · {goal.managerRole}
                    {goal.measureStat ? ` · план по ${goal.measureStat}` : ''}
                </span>
            </span>
            <span className="flex items-center gap-1 text-gray-500">
                {goal.reward.name}
                <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200"
                    onClick={() => onEdit(goal)}
                    title="Редактировать цель"
                >
                    <Pencil className="size-3.5 text-gray-400" />
                </button>
                <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100"
                    onClick={() => onDelete(goal.id)}
                    title="Удалить цель"
                >
                    <Trash2 className="size-3.5 text-red-400" />
                </button>
            </span>
        </div>
    )
}

// ─── RuleCard ─────────────────────────────────────────────────────────────────

interface RuleCardProps {
    rule: SalaryRule
    onUpdated: () => void
}

function RuleCard({
 rule, onUpdated 
}: RuleCardProps) {
    const [expanded, setExpanded] = useState(false)
    const [addingGoal, setAddingGoal] = useState(false)
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

    const { mutate: deleteRule } = useMutation({
        mutationFn: () => salaryApi.deleteRule(rule.id),
        onSuccess: () => {
            toast.success('Правило удалено')
            onUpdated()
        },
        onError: () => toast.error('Не удалось удалить правило'),
    })

    const { mutate: deleteGoal } = useMutation({
        mutationFn: (goalId: number) => salaryApi.deleteGoal(goalId),
        onSuccess: () => {
            toast.success('Цель удалена')
            onUpdated()
        },
        onError: () => toast.error('Не удалось удалить цель'),
    })

    const { mutate: changeStatus } = useMutation({
        mutationFn: (status: RuleStatus) => salaryApi.updateRule(rule.id, { status }),
        onSuccess: () => {
            toast.success('Статус обновлён')
            onUpdated()
        },
        onError: () => toast.error('Не удалось изменить статус'),
    })

    const statusClass =
        rule.status === 'ACTIVE'
            ? 'bg-emerald-100 text-emerald-700'
            : rule.status === 'ARCHIVED'
              ? 'bg-gray-100 text-gray-500'
              : 'bg-amber-100 text-amber-700'

    return (
        <Card>
            <CardHeader className="cursor-pointer" onClick={() => setExpanded((v) => !v)}>
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span className="flex items-center gap-2">
                        {expanded ? (
                            <ChevronDown className="size-4 text-gray-400" />
                        ) : (
                            <ChevronRight className="size-4 text-gray-400" />
                        )}
                        {rule.name}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-gray-400 font-normal">
                        <PayPerHourEditor rule={rule} onSaved={onUpdated} />
                        <select
                            value={rule.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                                e.stopPropagation()
                                changeStatus(e.target.value as RuleStatus)
                            }}
                            className={`h-6 px-2 rounded-full text-xs border-0 cursor-pointer outline-none ${statusClass}`}
                        >
                            <option value="DRAFT">DRAFT</option>
                            <option value="ACTIVE">ACTIVE</option>
                            <option value="ARCHIVED">ARCHIVED</option>
                        </select>
                        <button
                            className="p-1 rounded hover:bg-red-100"
                            onClick={(e) => {
                                e.stopPropagation()
                                if (
                                    confirm(
                                        'Удалить правило со всеми целями? Это действие необратимо.',
                                    )
                                ) {
                                    deleteRule()
                                }
                            }}
                            title="Удалить правило"
                        >
                            <Trash className="size-3.5 text-red-400" />
                        </button>
                    </span>
                </CardTitle>
            </CardHeader>

            {expanded && (
                <CardContent className="flex flex-col gap-2">
                    {rule.goals.length === 0 && (
                        <p className="text-sm text-gray-400">Целей пока нет</p>
                    )}

                    {rule.goals.map((goal) =>
                        editingGoal?.id === goal.id ? (
                            <GoalForm
                                key={goal.id}
                                ruleId={rule.id}
                                goal={goal}
                                onCancel={() => setEditingGoal(null)}
                                onCreated={() => {
                                    setEditingGoal(null)
                                    onUpdated()
                                }}
                            />
                        ) : (
                            <GoalRow
                                key={goal.id}
                                goal={goal}
                                onEdit={setEditingGoal}
                                onDelete={(id) => {
                                    if (confirm('Удалить цель? Это действие необратимо.'))
                                        deleteGoal(id)
                                }}
                            />
                        ),
                    )}

                    {addingGoal ? (
                        <GoalForm
                            ruleId={rule.id}
                            onCancel={() => setAddingGoal(false)}
                            onCreated={() => {
                                setAddingGoal(false)
                                onUpdated()
                            }}
                        />
                    ) : (
                        !editingGoal && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="self-start"
                                onClick={() => setAddingGoal(true)}
                            >
                                <Plus className="size-3.5" />
                                Добавить цель
                            </Button>
                        )
                    )}
                </CardContent>
            )}
        </Card>
    )
}

// ─── RulesView ────────────────────────────────────────────────────────────────

export function RulesView() {
    const [creating, setCreating] = useState(false)

    const queryClient = useQueryClient()
    const { data: employees = [] } = useQuery(employeesQuery)
    const { data: departments = [] } = useQuery(departmentsQuery)
    const {
 data: rules = [], isLoading, isError 
} = useQuery(rulesQuery)

    function invalidateRules() {
        queryClient.invalidateQueries({ queryKey: rulesQuery.queryKey })
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Правила мотивации</h2>
                <Button size="sm" onClick={() => setCreating((v) => !v)}>
                    <Plus className="size-3.5" />
                    Новое правило
                </Button>
            </div>

            {creating && (
                <CreateRuleForm
                    employees={employees}
                    departments={departments}
                    onSuccess={() => {
                        setCreating(false)
                        invalidateRules()
                    }}
                    onCancel={() => setCreating(false)}
                />
            )}

            {isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}
            {isError && <p className="text-sm text-red-500">Не удалось загрузить правила</p>}

            <div className="flex flex-col gap-3">
                {rules.map((rule) => (
                    <RuleCard key={rule.id} rule={rule} onUpdated={invalidateRules} />
                ))}
                {rules.length === 0 && !creating && !isLoading && (
                    <p className="text-sm text-gray-400">Правил пока нет — создайте первое.</p>
                )}
            </div>
        </div>
    )
}
