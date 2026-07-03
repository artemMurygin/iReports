import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Lock, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { salaryApi } from '../api'
import { employeesQuery, salaryReportQuery } from '../queries'
import { EmployeeSelect } from './EmployeeSelect'
import { MonthPicker } from '@/shared/ui/month-picker'
import { currentPeriod } from '../utils/period'
import { money } from '../utils/format'
import type { AccrualType, SalaryLineItem } from '../types'

const GROUP_LABELS: Record<string, string> = {
    HOURLY: 'Почасовая часть',
    BONUS: 'Бонусы по целям',
    PENALTY: 'Штрафы',
    ADJUSTMENT: 'Корректировки',
    FIXED: 'Оклад',
    ADVANCE: 'Аванс',
}

function groupLineItems(items: SalaryLineItem[]): [AccrualType, SalaryLineItem[]][] {
    const groups = new Map<AccrualType, SalaryLineItem[]>()
    for (const item of items) {
        const list = groups.get(item.accrualType) ?? []
        list.push(item)
        groups.set(item.accrualType, list)
    }
    return [...groups.entries()]
}

// ─── LineItemRow ──────────────────────────────────────────────────────────────

function LineItemRow({ item }: { item: SalaryLineItem }) {
    const [open, setOpen] = useState(false)
    const hasMeta = item.meta && Object.keys(item.meta).length > 0

    return (
        <div className="border-b border-gray-100 last:border-0">
            <button
                onClick={() => hasMeta && setOpen((v) => !v)}
                className={`flex items-center justify-between w-full px-3 py-2 text-sm text-left ${hasMeta ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            >
                <span className="flex items-center gap-1.5 text-gray-700">
                    {hasMeta ? (
                        open ? (
                            <ChevronDown className="size-3.5 text-gray-300 shrink-0" />
                        ) : (
                            <ChevronRight className="size-3.5 text-gray-300 shrink-0" />
                        )
                    ) : (
                        <span className="w-3.5 shrink-0" />
                    )}
                    {item.label}
                </span>
                <span className="flex items-center gap-4 tabular-nums shrink-0">
                    <span className={item.factAmount < 0 ? 'text-red-600' : 'text-gray-900'}>
                        {money(item.factAmount, true)}
                    </span>
                    <span className="text-gray-400 text-xs w-24 text-right">
                        прогноз {money(item.projected, true)}
                    </span>
                </span>
            </button>

            {open && hasMeta && (
                <div className="px-9 pb-2 text-xs text-gray-500 grid grid-cols-2 gap-x-6 gap-y-0.5">
                    {Object.entries(item.meta!).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2">
                            <span className="text-gray-400">{key}</span>
                            <span className="tabular-nums">
                                {typeof value === 'number' ? value.toFixed(2) : String(value)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── LineItemGroup ─────────────────────────────────────────────────────────────

function LineItemGroup({ type, items }: { type: AccrualType; items: SalaryLineItem[] }) {
    const subtotal = items.reduce((s, i) => s + i.factAmount, 0)
    return (
        <div className="border-b border-gray-100 last:border-0">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <span>{GROUP_LABELS[type] ?? type}</span>
                <span className="tabular-nums">{money(subtotal, true)}</span>
            </div>
            {items.map((item) => (
                <LineItemRow key={item.id} item={item} />
            ))}
        </div>
    )
}

// ─── AdjustmentForm ───────────────────────────────────────────────────────────

interface AdjustmentFormProps {
    employeeId: number
    period: string
    onSuccess: () => void
    onCancel: () => void
}

function AdjustmentForm({ employeeId, period, onSuccess, onCancel }: AdjustmentFormProps) {
    const [adjType, setAdjType] = useState<'PENALTY' | 'ADJUSTMENT'>('PENALTY')
    const [amount, setAmount] = useState('')
    const [reason, setReason] = useState('')

    const { mutate, isPending } = useMutation({
        mutationFn: () =>
            salaryApi.createAdjustment({
                employeeId,
                period,
                accrualType: adjType,
                amount: Number(amount),
                reason,
                createdById: employeeId,
            }),
        onSuccess: () => {
            toast.success('Корректировка добавлена')
            onSuccess()
        },
        onError: () => toast.error('Не удалось сохранить корректировку'),
    })

    function handleSave() {
        if (!amount || !reason.trim()) {
            toast.error('Заполните сумму и причину')
            return
        }
        mutate()
    }

    return (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50/30">
            <select
                value={adjType}
                onChange={(e) => setAdjType(e.target.value as 'PENALTY' | 'ADJUSTMENT')}
                className="h-9 px-3 rounded border border-gray-200 text-sm"
            >
                <option value="PENALTY">Штраф</option>
                <option value="ADJUSTMENT">Корректировка</option>
            </select>
            <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={adjType === 'PENALTY' ? 'Сумма (отрицательная), ₽' : 'Сумма, ₽'}
                className="h-9 px-3 rounded border border-gray-200 text-sm w-48 tabular-nums"
            />
            <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Причина"
                className="h-9 px-3 rounded border border-gray-200 text-sm flex-1 min-w-40"
            />
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
                Отмена
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
                Сохранить
            </Button>
        </div>
    )
}

// ─── SalaryView ───────────────────────────────────────────────────────────────

export function SalaryView() {
    const [period, setPeriod] = useState(currentPeriod())
    const [employeeId, setEmployeeId] = useState<number | null>(null)
    const [addingAdjustment, setAddingAdjustment] = useState(false)

    const queryClient = useQueryClient()

    const { data: employees = [] } = useQuery(employeesQuery)

    const {
        data: report,
        isLoading: reportLoading,
        isError: reportError,
    } = useQuery({
        ...salaryReportQuery(employeeId!, period),
        enabled: !!employeeId,
    })

    const { mutate: closeMonth, isPending: closing } = useMutation({
        mutationFn: () => salaryApi.closeSalaryReport(employeeId!, period),
        onSuccess: ({ data }) => {
            queryClient.setQueryData(salaryReportQuery(employeeId!, period).queryKey, data)
            toast.success('Месяц закрыт')
        },
        onError: () => toast.error('Не удалось закрыть месяц'),
    })

    function handleClose() {
        if (!confirm(`Закрыть месяц ${period}? После закрытия расчёт нельзя будет пересчитать.`))
            return
        closeMonth()
    }

    function invalidateReport() {
        queryClient.invalidateQueries({ queryKey: salaryReportQuery(employeeId!, period).queryKey })
    }

    const groups = report ? groupLineItems(report.lineItems) : []

    return (
        <div className="flex flex-col gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} />
                <MonthPicker value={period} onChange={setPeriod} />
                {report?.status === 'CLOSED' && (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500">
                        <Lock className="size-3" />
                        закрыт {report.closedAt?.slice(0, 10)}
                    </span>
                )}
            </div>

            {/* States */}
            {!employeeId && <p className="text-sm text-gray-400">Выберите сотрудника.</p>}
            {employeeId && reportLoading && <p className="text-sm text-gray-400">Загрузка…</p>}
            {employeeId && reportError && (
                <p className="text-sm text-red-500">Не удалось загрузить отчёт по ЗП</p>
            )}

            {/* Report */}
            {report && (
                <>
                    <div className="flex gap-8 px-6 py-5 rounded-xl bg-gray-50 border border-gray-100">
                        <div>
                            <div className="text-xs text-gray-400 mb-1">Начислено сейчас</div>
                            <div className="text-3xl font-semibold tabular-nums text-gray-900">
                                {money(report.factTotal)}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-400 mb-1">Прогноз за месяц</div>
                            <div className="text-3xl font-semibold tabular-nums text-emerald-600">
                                {money(report.projected)}
                            </div>
                        </div>
                        {report.status !== 'CLOSED' && (
                            <Button
                                variant="outline"
                                className="ml-auto self-center"
                                onClick={handleClose}
                                disabled={closing}
                            >
                                <Lock className="size-3.5" />
                                Закрыть месяц
                            </Button>
                        )}
                    </div>

                    <div className="rounded-lg border border-gray-100 overflow-hidden">
                        {groups.length === 0 ? (
                            <p className="text-sm text-gray-400 p-6 text-center">
                                Нет начислений за этот период
                            </p>
                        ) : (
                            groups.map(([type, items]) => (
                                <LineItemGroup key={type} type={type} items={items} />
                            ))
                        )}
                    </div>

                    {report.status !== 'CLOSED' && (
                        <div className="flex flex-col gap-2">
                            {addingAdjustment ? (
                                <AdjustmentForm
                                    employeeId={employeeId!}
                                    period={period}
                                    onSuccess={() => {
                                        setAddingAdjustment(false)
                                        invalidateReport()
                                    }}
                                    onCancel={() => setAddingAdjustment(false)}
                                />
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="self-start"
                                    onClick={() => setAddingAdjustment(true)}
                                >
                                    <Plus className="size-3.5" />
                                    Штраф / корректировка
                                </Button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
