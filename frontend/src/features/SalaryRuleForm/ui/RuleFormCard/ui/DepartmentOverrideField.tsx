import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

/** Same `{ id, name }` shape as `features/TargetDirectory`'s `TargetOption` — not imported directly
 * (features can't cross-import, frontend/CLAUDE.md), the caller (a page) passes data of this shape. */
export type DepartmentOverrideOption = { id: number; name: string }

const OWN_DEPARTMENT_VALUE = 'own'

export type DepartmentOverrideFieldProps = {
    /** `''` — «свой отдел» (нет переопределения), иначе id отдела как строка. Mirrors
     * `RuleDraft.departmentIdOverride`. */
    value: string
    onValueChange: (value: string) => void
    departments: DepartmentOverrideOption[]
    isLoading?: boolean
    error?: string | null
}

/**
 * Временный костыль поверх add-department-head-salary-rules design.md Decision 1 — явный выбор
 * отдела, чей план продаж используется для `DepartmentPercent`/`DepartmentPlanBonus`, вместо
 * собственного отдела сотрудника (см. `RuleDraft.departmentIdOverride`'s комментарий за WHY). В
 * отличие от обязательного `WarehouseField` (FR4), это поле опционально — первый пункт списка
 * («Свой отдел») явно возвращает состояние «без переопределения», а не просто placeholder.
 */
export function DepartmentOverrideField({
    value,
    onValueChange,
    departments,
    isLoading,
    error,
}: DepartmentOverrideFieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="font-ui text-xs font-medium text-ink-muted">Отдел плана (необязательно)</label>
            <Select
                value={value === '' ? OWN_DEPARTMENT_VALUE : value}
                onValueChange={(next) => onValueChange(next === OWN_DEPARTMENT_VALUE ? '' : next)}
                disabled={isLoading}
            >
                <SelectTrigger>
                    <SelectValue placeholder={isLoading ? 'Загрузка...' : 'Свой отдел'} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={OWN_DEPARTMENT_VALUE}>Свой отдел</SelectItem>
                    {departments.map((department) => (
                        <SelectItem key={department.id} value={String(department.id)}>
                            {department.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {error && <p className="font-ui text-xs text-danger">Не удалось загрузить список отделов</p>}
        </div>
    )
}
