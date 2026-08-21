import type { TargetOption } from '@/features/TargetDirectory'
import { PeriodPicker } from '@/features/SalesPlan'

import { cn } from '@/shared/lib/tw'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import type { SalaryReportScope } from '../model/useSalaryReportPage.ts'
import { SALARY_DIRECTION_LABELS, type SalaryDirection } from '../model/types.ts'

const SCOPE_OPTIONS: SegmentedControlOption<SalaryReportScope>[] = [
    { value: 'employee', label: 'Сотрудник' },
    { value: 'department', label: 'Отдел' },
]

const DIRECTION_OPTIONS: SegmentedControlOption<SalaryDirection>[] = [
    { value: 'service', label: SALARY_DIRECTION_LABELS.service },
    { value: 'shop', label: SALARY_DIRECTION_LABELS.shop },
]

export type SalaryReportFiltersProps = {
    scope: SalaryReportScope
    onScopeChange: (scope: SalaryReportScope) => void

    employees: TargetOption[]
    isEmployeesLoading: boolean
    employeeId: number | null
    onEmployeeIdChange: (id: number | null) => void

    departments: TargetOption[]
    isDepartmentsLoading: boolean
    departmentId: number | null
    onDepartmentIdChange: (id: number | null) => void

    /** Направление отчёта отдела — не используется в режиме "Сотрудник" (тот показывает оба
     * направления сразу и их сумму, см. `useEmployeeSalaryReport`), поэтому переключатель
     * направления рендерится только при `scope === 'department'`. */
    direction: SalaryDirection
    onDirectionChange: (direction: SalaryDirection) => void

    period: string
    onPeriodChange: (period: string) => void

    className?: string
}

/**
 * Filter Row страницы `/salaries` (Pencil: design/sallary-first-iteration.pen, узлы `t3QCM`/
 * `b6mfxv` — «Filter Row» верх каждого из экранов отчёта). Единственная точка ветвления по
 * `scope`, вынесенная из мидиатора (`useSalaryReportPage`)/страницы в этот презентационный
 * компонент по правилу «медиатор без `&&`/тернарников» (`frontend/CLAUDE.md`): режим «Сотрудник»
 * показывает `Select` сотрудника, режим «Отдел» — `Select` отдела и дополнительный
 * `SegmentedControl` направления (Сервис/Магазин) — отчёт отдела строго однонаправленный на
 * бэкенде, см. `model/api.ts`.
 *
 * Один компонент на оба брейкпоинта (`flex-wrap`), а не отдельные десктоп/мобильный варианты —
 * набор полей одинаков на обеих раскладках макета (`t3QCM`/`Z0lgF`, `b6mfxv`/`d8XFk`), меняется
 * только их расположение, что `flex-wrap` даёт бесплатно (тот же приём, что и в
 * `pages/SalesPlan/ui/PageHeader.tsx`).
 */
export function SalaryReportFilters({
    scope,
    onScopeChange,
    employees,
    isEmployeesLoading,
    employeeId,
    onEmployeeIdChange,
    departments,
    isDepartmentsLoading,
    departmentId,
    onDepartmentIdChange,
    direction,
    onDirectionChange,
    period,
    onPeriodChange,
    className,
}: SalaryReportFiltersProps) {
    const isEmployeeScope = scope === 'employee'

    const targetSelect = isEmployeeScope ? (
        <Select
            value={employeeId != null ? String(employeeId) : undefined}
            onValueChange={(value) => onEmployeeIdChange(Number(value))}
            disabled={isEmployeesLoading}
        >
            <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Выберите сотрудника" />
            </SelectTrigger>
            <SelectContent>
                {employees.map((employee) => (
                    <SelectItem key={employee.id} value={String(employee.id)}>
                        {employee.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    ) : (
        <Select
            value={departmentId != null ? String(departmentId) : undefined}
            onValueChange={(value) => onDepartmentIdChange(Number(value))}
            disabled={isDepartmentsLoading}
        >
            <SelectTrigger className="w-full md:w-64">
                <SelectValue placeholder="Выберите отдел" />
            </SelectTrigger>
            <SelectContent>
                {departments.map((department) => (
                    <SelectItem key={department.id} value={String(department.id)}>
                        {department.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )

    return (
        <div data-slot="salary-report-filters" className={cn('flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between', className)}>
            <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl aria-label="Режим отчёта" options={SCOPE_OPTIONS} value={scope} onValueChange={onScopeChange} />
                {targetSelect}
                {!isEmployeeScope && (
                    <SegmentedControl
                        aria-label="Направление"
                        options={DIRECTION_OPTIONS}
                        value={direction}
                        onValueChange={onDirectionChange}
                    />
                )}
            </div>

            <PeriodPicker period={period} onPeriodChange={onPeriodChange} />
        </div>
    )
}
