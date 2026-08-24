import { PeriodPicker } from '@/features/SalesPlan'
import type { TargetOption } from '@/features/TargetDirectory'
import { cn } from '@/shared/lib/tw'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

export type PageHeaderProps = {
    departments: TargetOption[]
    isDepartmentsLoading: boolean
    departmentId: number | null
    onDepartmentIdChange: (id: number) => void
    period: string
    onPeriodChange: (period: string) => void
    className?: string
}

/**
 * Pencil `IFJW2` (`Баланс · Отдел`, десктоп) / `iEYMb` (мобильный): заголовок «Балансы
 * сотрудников», подпись, `Select` отдела и Period Chip.
 *
 * `Select` отдела — тот же ручной паттерн (`Select`/`SelectTrigger`/`SelectContent`/
 * `SelectItem` из `@/shared/ui-kit/atoms/Select`, `useDepartments()` из
 * `@/features/TargetDirectory`), что department-`Select` в `SalaryReportFilters`
 * (`pages/SalaryReport/ui/SalaryReportFilters.tsx`). Period Chip — тот же `PeriodPicker`
 * (`@/features/SalesPlan`), что использует `pages/SalaryAccruals/ui/PageHeader.tsx`.
 *
 * Без Direction Tabs (`Сервис`/`Магазин`/`Все` в мокапе) — баланс отдела общий, ответ
 * `getDepartmentBalances` не делится по направлениям (Фаза 8b): фильтр направления в
 * контракте отсутствует, поэтому переключатель здесь был бы декоративным.
 */
function PageHeader({
    departments,
    isDepartmentsLoading,
    departmentId,
    onDepartmentIdChange,
    period,
    onPeriodChange,
    className,
}: PageHeaderProps) {
    return (
        <div data-slot="department-balances-page-header" className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-col gap-1">
                <h1 className="font-display text-[26px] font-bold tracking-[-0.4px] text-ink">
                    Балансы сотрудников
                </h1>
                <p className="font-ui text-sm text-ink-muted">
                    Остатки по сотрудникам текущего состава отдела · данные о составе из Bitrix24
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Select
                    value={departmentId !== null ? String(departmentId) : undefined}
                    onValueChange={(value) => onDepartmentIdChange(Number(value))}
                    disabled={isDepartmentsLoading}
                >
                    <SelectTrigger className="w-full md:w-72">
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

                <PeriodPicker period={period} onPeriodChange={onPeriodChange} />
            </div>
        </div>
    )
}

export { PageHeader }
