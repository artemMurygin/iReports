import { Building2, Search } from 'lucide-react'
import type { TargetOption } from '@/features/TargetDirectory'
import { PeriodPicker } from '@/features/SalesPlan'
import { SALARY_DIRECTION_LABELS, type SalaryReportScope } from '@/features/SalaryReportData'

import { cn } from '@/shared/lib/tw'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import type { DepartmentDirectionFilter } from '../model/useDepartmentSalaryReportAll.ts'

/** «Все» — только у этой страницы (см. `useDepartmentSalaryReportAll`'s комментарий): сведение
 * обоих направлений отчёта отдела на фронте, старый `/salaries` этой вкладки не получает. */
const DIRECTION_OPTIONS: SegmentedControlOption<DepartmentDirectionFilter>[] = [
    { value: 'all', label: 'Все' },
    { value: 'service', label: SALARY_DIRECTION_LABELS.service },
    { value: 'shop', label: SALARY_DIRECTION_LABELS.shop },
]

export type SalaryReportFiltersV2Props = {
    scope: SalaryReportScope

    departments: TargetOption[]
    isDepartmentsLoading: boolean
    departmentId: number | null
    onDepartmentIdChange: (id: number | null) => void

    direction: DepartmentDirectionFilter
    onDirectionChange: (direction: DepartmentDirectionFilter) => void

    employeeSearch: string
    onEmployeeSearchChange: (search: string) => void

    period: string
    onPeriodChange: (period: string) => void

    className?: string
}

/**
 * Filter Row страницы `/salaries` (Pencil: узел `AqQmX` "Filter Row" — «Зарплата отдела», `wVa5g`).
 * Только для отчёта отдела (`scope === 'department'`) — режим отчёта («Сотрудник»/«Отдел») больше не
 * переключается вручную, он полностью определяется маршрутом (`/salaries` -> "Отдел",
 * `/salaries/employee/:id` -> "Сотрудник", см. `model/useSalaryReportPage.ts`), а у отчёта сотрудника
 * своя, более короткая панель — `EmployeeReportHeaderActions` (`PeriodPicker` + «Назад к отделу» в
 * шапке страницы), не эта. `scope` здесь — только чтобы вернуть `null` в режиме "Сотрудник" (см.
 * `frontend/CLAUDE.md`'s "медиатор/страница не должен содержать условного рендера" — ветвление
 * живёт в компоненте, а не в `SalaryReportV2Page`).
 *
 * `direction` здесь — `DepartmentDirectionFilter` (`SalaryDirection | 'all'`), не голый
 * `SalaryDirection`: добавлена вкладка «Все» — сведение обоих направлений отчёта отдела на фронте
 * (см. `useDepartmentSalaryReportAll`), только на этой странице.
 *
 * Порядок слева направо — Direction Tabs → Select «Отдел» → Search «Поиск по сотруднику»
 * (220px, `employeeSearch`/`onEmployeeSearchChange`) — клиентский текстовый фильтр по уже
 * загруженному `departmentReport.employees[].name` (см. `model/filterEmployeesBySearch.ts`,
 * применяется внутри `DepartmentLedgerV2`), контракт отчёта серверного поиска не отдаёт.
 *
 * Select «Отдел» — тот же `SelectTrigger`/`SelectValue` + иконка `Building2`, что и на
 * `/salary-accruals` и `/balance` (`pages/SalaryAccruals/ui/PageHeader.tsx`,
 * `pages/EmployeeSettlements/ui/PageHeader.tsx`) — единый вид виджета выбора отдела по всем
 * страницам зарплаты. В отличие от них здесь нет сентинела «Все отделы»: на этой странице
 * `departmentId` всегда резолвится в конкретный отдел (дефолт «Розница» — см.
 * `useSalaryReportPage.ts`), выбора "все отделы сразу" отчёт отдела не поддерживает.
 */
export function SalaryReportFiltersV2({
    scope,
    departments,
    isDepartmentsLoading,
    departmentId,
    onDepartmentIdChange,
    direction,
    onDirectionChange,
    employeeSearch,
    onEmployeeSearchChange,
    period,
    onPeriodChange,
    className,
}: SalaryReportFiltersV2Props) {
    if (scope !== 'department') {
        return null
    }

    return (
        <div
            data-slot="salary-report-filters-v2"
            className={cn('flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between', className)}
        >
            <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl
                    aria-label="Направление"
                    options={DIRECTION_OPTIONS}
                    value={direction}
                    onValueChange={onDirectionChange}
                />

                <Select
                    value={departmentId != null ? String(departmentId) : ''}
                    onValueChange={(value) => onDepartmentIdChange(Number(value))}
                    disabled={isDepartmentsLoading}
                >
                    <SelectTrigger className="h-10 w-full gap-2 md:w-[250px]">
                        <Building2 className="size-[15px] shrink-0 text-ink-muted" />
                        <SelectValue placeholder="Отдел" />
                    </SelectTrigger>
                    <SelectContent>
                        {departments.map((department) => (
                            <SelectItem key={department.id} value={String(department.id)}>
                                {department.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative w-full md:w-[220px]">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-[14px] -translate-y-1/2 text-ink-faint" />
                    <Input
                        value={employeeSearch}
                        onChange={(event) => onEmployeeSearchChange(event.target.value)}
                        placeholder="Поиск по сотруднику"
                        className="pl-8"
                    />
                </div>
            </div>

            <PeriodPicker period={period} onPeriodChange={onPeriodChange} />
        </div>
    )
}
