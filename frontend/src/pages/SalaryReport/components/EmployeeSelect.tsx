import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import type { Employee } from '../types'

interface Props {
    employees: Employee[]
    value: number | null
    onChange: (employeeId: number) => void
    placeholder?: string
}

export function EmployeeSelect({ employees, value, onChange, placeholder = 'Сотрудник' }: Props) {
    return (
        <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
            <SelectTrigger className="min-w-56">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
                {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                        {e.lastName} {e.firstName}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
