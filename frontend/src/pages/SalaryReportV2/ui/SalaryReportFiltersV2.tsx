import type { TargetOption } from '@/features/TargetDirectory'
import { PeriodPicker } from '@/features/SalesPlan'
import { SALARY_DIRECTION_LABELS, type SalaryReportScope } from '@/features/SalaryReportData'

import { cn } from '@/shared/lib/tw'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import type { DepartmentDirectionFilter } from '../model/useDepartmentSalaryReportAll.ts'

const SCOPE_OPTIONS: SegmentedControlOption<SalaryReportScope>[] = [
    { value: 'employee', label: 'Сотрудник' },
    { value: 'department', label: 'Отдел' },
]

/** «Все» — только у этой страницы (см. `useDepartmentSalaryReportAll`'s комментарий): сведение
 * обоих направлений отчёта отдела на фронте, старый `/salaries` этой вкладки не получает. */
const DIRECTION_OPTIONS: SegmentedControlOption<DepartmentDirectionFilter>[] = [
    { value: 'all', label: 'Все' },
    { value: 'service', label: SALARY_DIRECTION_LABELS.service },
    { value: 'shop', label: SALARY_DIRECTION_LABELS.shop },
]

export type SalaryReportFiltersV2Props = {
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

    direction: DepartmentDirectionFilter
    onDirectionChange: (direction: DepartmentDirectionFilter) => void

    period: string
    onPeriodChange: (period: string) => void

    className?: string
}

/**
 * Filter Row страницы `/salaries` (Pencil: узлы `VCURn` "Filter Row" — «Зарплата сотрудника»,
 * `wLtzp`; `AqQmX` "Filter Row" — «Зарплата отдела», `wVa5g`). Функционально — тот же набор
 * полей/поведение, что и `pages/SalaryReport/ui/SalaryReportFilters.tsx` (то же самое состояние из
 * `model/useSalaryReportPage.ts`, тот же выбор "Сотрудник показывает оба направления сразу →
 * переключатель направления скрыт" — см. её комментарий), но не переиспользует тот компонент
 * напрямую (`pages` не может импортировать другую `pages`, `boundaries/dependencies`) и заведён как
 * отдельный, отдающий Foundation-фазе рабочий (не заглушечный) header — Pencil-макет фильтров не
 * входит в контракт `EmployeeReportBodyV2Props`/`DepartmentReportBodyV2Props`, которые фазе UI
 * поручено наполнить.
 *
 * ТОЧКА ДОРАБОТКИ (не в скоупе Foundation): в новом макете расположение полей отличается от
 * `SalaryReportFilters` — режим "Сотрудник" показывает `Avatar` слева от `Select` (`T0KPq`), режим
 * "Отдел" использует явный `Direction Tabs` (`SoUdn`, `ERP/Molecule/Tabs`) вместо
 * `SegmentedControl`, а справа в обоих режимах — `Period Chip`/`Badge` вместо текущего
 * `PeriodPicker`. Здесь сохранена функциональная и поведенческая эквивалентность (тот же
 * `SegmentedControl` для `scope`/`direction`, тот же `PeriodPicker`), а не визуальное 1:1
 * совпадение с этими узлами — сама панель фильтров не входит в разбивку "тело сотрудника / тело
 * отдела" между двумя параллельными UI-агентами.
 *
 * `direction` здесь — `DepartmentDirectionFilter` (`SalaryDirection | 'all'`), не голый
 * `SalaryDirection` мокапа `SoUdn`/старой `SalaryReportFilters`: добавлена вкладка «Все» —
 * сведение обоих направлений отчёта отдела на фронте (см. `useDepartmentSalaryReportAll`), только
 * на этой странице.
 */
export function SalaryReportFiltersV2({
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
}: SalaryReportFiltersV2Props) {
    const isEmployeeScope = scope === 'employee'

    const targetSelect = isEmployeeScope ? (
        <Select
            value={employeeId != null ? String(employeeId) : ''}
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
            value={departmentId != null ? String(departmentId) : ''}
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
        <div
            data-slot="salary-report-filters-v2"
            className={cn(
                'flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between',
                className,
            )}
        >
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
