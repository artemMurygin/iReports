import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { salaryApi } from '../api'
import { employeesQuery, workScheduleQuery } from '../queries'
import { EmployeeSelect } from './EmployeeSelect'
import { MonthPicker } from '@/shared/ui/month-picker'
import { currentPeriod } from '../utils/period'
import type { WorkShift } from '../types'

const STATUSES = ['planned', 'worked', 'absent', 'vacation', 'sick']

type ShiftRow = {
    date: string
    plannedHours: string
    actualHours: string
    status: string
    note: string
}

function daysInMonth(period: string): string[] {
    const [year, month] = period.split('-').map(Number)
    const total = new Date(year, month, 0).getDate()
    return Array.from({ length: total }, (_, i) => {
        const d = String(i + 1).padStart(2, '0')
        return `${period}-${d}`
    })
}

function shiftsToRows(shifts: WorkShift[], period: string): ShiftRow[] {
    const byDate = new Map<string, WorkShift>(shifts.map((s) => [s.date.slice(0, 10), s]))
    return daysInMonth(period).map((date) => {
        const shift = byDate.get(date)
        return {
            date,
            plannedHours: shift ? String(shift.plannedHours) : '',
            actualHours: shift?.actualHours != null ? String(shift.actualHours) : '',
            status: shift?.status ?? 'planned',
            note: shift?.note ?? '',
        }
    })
}

export function WorkScheduleView() {
    const [period, setPeriod] = useState(currentPeriod())
    const [employeeId, setEmployeeId] = useState<number | null>(null)
    const [rows, setRows] = useState<ShiftRow[]>([])

    const { data: employees = [] } = useQuery(employeesQuery)

    const { data: serverShifts } = useQuery({
        ...workScheduleQuery(employeeId!, period),
        enabled: !!employeeId,
    })

    // Initialise editable rows whenever server data or period changes
    useEffect(() => {
        setRows(
            serverShifts
                ? shiftsToRows(serverShifts, period)
                : daysInMonth(period).map((date) => ({
                      date,
                      plannedHours: '',
                      actualHours: '',
                      status: 'planned',
                      note: '',
                  })),
        )
    }, [serverShifts, period])

    const totals = useMemo(
        () => ({
            planned: rows.reduce((s, r) => s + (Number(r.plannedHours) || 0), 0),
            actual: rows.reduce((s, r) => s + (Number(r.actualHours) || 0), 0),
        }),
        [rows],
    )

    function updateRow(date: string, patch: Partial<ShiftRow>) {
        setRows((prev) => prev.map((r) => (r.date === date ? { ...r, ...patch } : r)))
    }

    const {
 mutate: saveSchedule, isPending: saving 
} = useMutation({
        mutationFn: () => {
            const shifts = rows
                .filter((r) => r.plannedHours !== '')
                .map((r) => ({
                    employeeId: employeeId!,
                    date: r.date,
                    plannedHours: Number(r.plannedHours) || 0,
                    actualHours: r.actualHours === '' ? undefined : Number(r.actualHours),
                    status: r.status,
                    note: r.note || undefined,
                }))
            if (shifts.length === 0) throw new Error('empty')
            return salaryApi.bulkUpsertShifts(shifts)
        },
        onSuccess: () => toast.success('График сохранён'),
        onError: (e) => {
            if ((e as Error).message === 'empty') {
                toast.error('Заполните хотя бы одну плановую смену')
            } else {
                toast.error('Не удалось сохранить график')
            }
        },
    })

    return (
        <div className="flex flex-col gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} />
                <MonthPicker value={period} onChange={setPeriod} />
                {employeeId && (
                    <Button size="sm" onClick={() => saveSchedule()} disabled={saving}>
                        Сохранить график
                    </Button>
                )}
                {employeeId && (
                    <span className="text-sm text-gray-400 tabular-nums">
                        План: {totals.planned} ч · Факт: {totals.actual} ч
                    </span>
                )}
            </div>

            {!employeeId ? (
                <p className="text-sm text-gray-400">Выберите сотрудника, чтобы увидеть график.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Дата</TableHead>
                            <TableHead className="text-right">План, ч</TableHead>
                            <TableHead className="text-right">Факт, ч</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Примечание</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.date}>
                                <TableCell className="tabular-nums">
                                    {row.date.slice(8, 10)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <input
                                        type="number"
                                        value={row.plannedHours}
                                        onChange={(e) =>
                                            updateRow(row.date, { plannedHours: e.target.value })
                                        }
                                        className="w-16 h-8 px-2 text-right rounded border border-gray-200 tabular-nums"
                                    />
                                </TableCell>
                                <TableCell className="text-right">
                                    <input
                                        type="number"
                                        value={row.actualHours}
                                        onChange={(e) =>
                                            updateRow(row.date, { actualHours: e.target.value })
                                        }
                                        className="w-16 h-8 px-2 text-right rounded border border-gray-200 tabular-nums"
                                    />
                                </TableCell>
                                <TableCell>
                                    <select
                                        value={row.status}
                                        onChange={(e) =>
                                            updateRow(row.date, { status: e.target.value })
                                        }
                                        className="h-8 px-2 rounded border border-gray-200 text-sm"
                                    >
                                        {STATUSES.map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </TableCell>
                                <TableCell>
                                    <input
                                        value={row.note}
                                        onChange={(e) =>
                                            updateRow(row.date, { note: e.target.value })
                                        }
                                        className="w-full h-8 px-2 rounded border border-gray-200 text-sm"
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
    )
}
