import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Pencil, X } from 'lucide-react'
import { salaryApi } from '../api'
import type { Employee } from '../types'

interface Props {
    employees: Employee[]
    onUpdated: (employee: Employee) => void
}

export function OnlineNameMapping({ employees, onUpdated }: Props) {
    const [editingId, setEditingId] = useState<number | null>(null)
    const [draft, setDraft] = useState('')

    async function handleSave(employee: Employee) {
        const name = draft.trim() || null
        try {
            const res = await salaryApi.updateEmployee(employee.id, { roappOnlineName: name })
            onUpdated(res.data)
            toast.success('Сохранено')
            setEditingId(null)
        } catch {
            toast.error('Не удалось сохранить')
        }
    }

    return (
        <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-500 mb-1">
                Укажите имя онлайн-менеджера из Roapp для каждого сотрудника, чтобы мотивация по
                онлайн-роли считалась корректно.
            </p>
            {employees.map((emp) => (
                <div
                    key={emp.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-sm group"
                >
                    <span className="w-40 text-gray-700 shrink-0">
                        {emp.lastName} {emp.firstName}
                    </span>
                    {editingId === emp.id ? (
                        <span className="flex items-center gap-1">
                            <input
                                autoFocus
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave(emp)
                                    if (e.key === 'Escape') setEditingId(null)
                                }}
                                placeholder="имя в Roapp"
                                className="h-6 px-2 rounded border border-gray-200 text-xs w-40"
                            />
                            <button
                                className="p-1 rounded hover:bg-emerald-100"
                                onClick={() => handleSave(emp)}
                            >
                                <Check className="size-3.5 text-emerald-600" />
                            </button>
                            <button
                                className="p-1 rounded hover:bg-gray-200"
                                onClick={() => setEditingId(null)}
                            >
                                <X className="size-3.5 text-gray-400" />
                            </button>
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5">
                            <span
                                className={
                                    emp.roappOnlineName ? 'text-gray-600' : 'text-gray-300 italic'
                                }
                            >
                                {emp.roappOnlineName ?? 'не задано'}
                            </span>
                            <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200"
                                onClick={() => {
                                    setDraft(emp.roappOnlineName ?? '')
                                    setEditingId(emp.id)
                                }}
                            >
                                <Pencil className="size-3 text-gray-400" />
                            </button>
                        </span>
                    )}
                </div>
            ))}
        </div>
    )
}
