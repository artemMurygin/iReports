import { Building2, Clock, Download, Search } from 'lucide-react'
import type { TargetOption } from '@/features/TargetDirectory'
import { buildDepartmentSelectOptions, ALL_DEPARTMENTS_VALUE } from '../model/departmentOptions.ts'
import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

export type PageHeaderProps = {
    departments: TargetOption[]
    isDepartmentsLoading: boolean
    departmentId: number | null
    onDepartmentIdChange: (id: number | null) => void
    employeesCount: number
    search: string
    onSearchChange: (search: string) => void
    dataAsOfLabel: string | null
    /** «Выгрузить таблицу» (Pencil `IFJW2` top-right, Фаза 4 docs/employee-settlements-page-
     * redesign) — CSV уже построенных `employees`/`totals`, см. `EmployeeSettlementsPage`. */
    onExport: () => void
    className?: string
}

/**
 * Pencil `IFJW2` (десктоп) / `wZnzC` (мобайл) — `Взаиморасчёты с сотрудниками`: заголовок +
 * подпись + «Выгрузить таблицу» на одном уровне (десктоп: рядом, мобайл: под заголовком —
 * `flex-wrap`), затем `Select` отдела, поиск по сотруднику, и отметка свежести данных
 * («Данные на 25 авг 2026, 14:30»). На десктопе это один ряд с отметкой, прижатой к правому
 * краю (`md:ml-auto`); на мобайле (Фаза 4) — три отдельные строки (`flex-col`), как на `wZnzC`,
 * отметка свежести данных не прижата вправо, а идёт своей строкой слева (`self-start`).
 *
 * Select «Отдел» — тот же простой `SelectTrigger`/`SelectValue` + иконка `Building2`, что и на
 * `/salary-accruals` (`pages/SalaryAccruals/ui/PageHeader.tsx`), а не собственный composed
 * двухстрочный триггер с числом сотрудников (число уже видно в KPI-карточке «Общий остаток»
 * ниже, дублировать его здесь не нужно) — вид виджета выбора отдела унифицирован между
 * страницами.
 */
function PageHeader({
    departments,
    isDepartmentsLoading,
    departmentId,
    onDepartmentIdChange,
    employeesCount,
    search,
    onSearchChange,
    dataAsOfLabel,
    onExport,
    className,
}: PageHeaderProps) {
    const options = buildDepartmentSelectOptions(departments)

    return (
        <div data-slot="employee-settlements-page-header" className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-[26px] font-bold tracking-[-0.4px] text-ink">
                        Взаиморасчёты с сотрудниками
                    </h1>
                    <p className="font-ui text-sm text-ink-muted">
                        Текущий остаток баланса по каждому сотруднику · состав отдела из Bitrix24
                    </p>
                </div>

                <Button type="button" variant="secondary" onClick={onExport} disabled={employeesCount === 0}>
                    <Download />
                    Выгрузить таблицу
                </Button>
            </div>

            {/* Мобильная раскладка (Pencil `wZnzC`, Фаза 4): отдел/поиск/отметка свежести
                данных — каждый в своей строке (`flex-col`), а не сжаты в одну, как на
                десктопе (`md:flex-row`, тот же ряд, что и в Фазе 3). */}
            <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                <Select
                    value={departmentId !== null ? String(departmentId) : ALL_DEPARTMENTS_VALUE}
                    onValueChange={(value) =>
                        onDepartmentIdChange(value === ALL_DEPARTMENTS_VALUE ? null : Number(value))
                    }
                    disabled={isDepartmentsLoading}
                >
                    <SelectTrigger className="h-10 w-full gap-2 md:w-[250px]">
                        <Building2 className="size-[15px] shrink-0 text-ink-muted" />
                        <SelectValue placeholder="Отдел" />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative min-w-[220px] flex-1 md:max-w-[320px]">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-ink-faint" />
                    <Input
                        type="search"
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Поиск по сотруднику"
                        aria-label="Поиск по сотруднику"
                        className="pl-9"
                    />
                </div>

                {dataAsOfLabel && (
                    <span className="flex w-fit shrink-0 items-center gap-1.5 self-start rounded-full border border-hairline bg-surface px-3 py-[7px] font-ui text-xs text-ink-muted md:ml-auto">
                        <Clock className="size-3.5 shrink-0" />
                        Данные на {dataAsOfLabel}
                    </span>
                )}
            </div>
        </div>
    )
}

export { PageHeader }
