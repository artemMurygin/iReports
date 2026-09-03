import { Building2, Wallet } from 'lucide-react'
import type { SalesDirection } from 'ireports-contracts'

import type { TargetOption } from '@/features/TargetDirectory'
import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'
import { PeriodPicker } from '@/features/SalesPlan'

const DIRECTIONS: { value: SalesDirection; label: string }[] = [
    { value: 'service', label: 'Сервис' },
    { value: 'shop', label: 'Магазин' },
]

/** Значение Select «Отдел» для пункта «Все отделы» — реальный `departmentId` не бывает пустой
 * строкой, а Radix Select не допускает `value=""` у `SelectItem`, поэтому у «без фильтра» свой
 * непустой сентинел. */
const ALL_DEPARTMENTS_VALUE = 'all'

export type PageHeaderProps = {
    direction: SalesDirection
    onDirectionChange: (direction: SalesDirection) => void
    departments: TargetOption[]
    isDepartmentsLoading: boolean
    departmentId: number | null
    onDepartmentIdChange: (id: number | null) => void
    period: string
    onPeriodChange: (period: string) => void
    isPeriodClosed: boolean
    /** Не-`PAID` документов в текущем списке — кнопка «Начислить все документы месяца»
     * видна только пока их больше нуля (Фаза 9). */
    nonPaidCount: number
    onAccrueAllMonth: () => void
    className?: string
}

/**
 * Заголовок списка начислений — та же title/subtitle-размерность, что и на соседних страницах
 * (`pages/EmployeeSettlements/ui/PageHeader.tsx`, `shared/ui-kit/organisms/PageHeader.tsx`):
 * `<h1>` `text-[26px]`, без icon-бокса, подпись `text-sm`. Раньше здесь была отдельная Dept
 * Row (иконка `building-2` + название отдела/«Все отделы») под заголовком — убрана: имя отдела
 * и так видно в самом Select «Отдел» ниже, а под заголовком остаётся только одна строка —
 * `subtitle`.
 *
 * Direction Tabs старой версии стали «Scope Controls»: добавлен Select «Отдел» (иконка
 * `building-2`, пункт «Все отделы» первым — фильтр по отделу, которого не было в исходном
 * макете списка, но есть на `/salaries`, см. `SalaryReportFiltersV2`).
 */
function PageHeader({
    direction,
    onDirectionChange,
    departments,
    isDepartmentsLoading,
    departmentId,
    onDepartmentIdChange,
    period,
    onPeriodChange,
    isPeriodClosed,
    nonPaidCount,
    onAccrueAllMonth,
    className,
}: PageHeaderProps) {
    const subtitle = isPeriodClosed
        ? 'Документ начисления создаётся на каждого сотрудника при закрытии месяца'
        : 'Документы начисления появляются после закрытия месяца'

    const departmentSelect = (
        <Select
            value={departmentId !== null ? String(departmentId) : ALL_DEPARTMENTS_VALUE}
            onValueChange={(value) => onDepartmentIdChange(value === ALL_DEPARTMENTS_VALUE ? null : Number(value))}
            disabled={isDepartmentsLoading}
        >
            <SelectTrigger className="h-10 w-full gap-2 md:w-[250px]">
                <Building2 className="size-[15px] shrink-0 text-ink-muted" />
                <SelectValue placeholder="Отдел" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={ALL_DEPARTMENTS_VALUE}>Все отделы</SelectItem>
                {departments.map((department) => (
                    <SelectItem key={department.id} value={String(department.id)}>
                        {department.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )

    const directionTabs = (
        <div
            className="flex items-center gap-1 rounded-[10px] bg-hairline p-1 md:w-fit"
            role="tablist"
            aria-label="Направление"
        >
            {DIRECTIONS.map(({ value, label }) => (
                <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={direction === value}
                    onClick={() => onDirectionChange(value)}
                    className={cn(
                        'flex-1 rounded-lg px-3 py-1.5 font-ui text-[13px] transition-colors select-none md:flex-none',
                        direction === value
                            ? 'bg-surface font-semibold text-ink shadow-sm'
                            : 'font-medium text-ink-muted hover:text-ink',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    )

    const periodPill = isPeriodClosed ? (
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-info-soft px-3 py-[7px]">
            <span className="size-[7px] rounded-full bg-info-ink" />
            <span className="font-ui text-[13px] font-medium text-info-ink">Период закрыт</span>
        </div>
    ) : (
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-[7px]">
            <span className="size-[7px] rounded-full bg-brand-strong" />
            <span className="font-ui text-[13px] font-medium text-ok-ink">Период открыт</span>
        </div>
    )

    const accrueAllButton = nonPaidCount > 0 && (
        <Button type="button" variant="secondary" onClick={onAccrueAllMonth} className="w-full md:w-auto">
            <Wallet />
            Начислить все документы месяца
        </Button>
    )

    return (
        <div data-slot="salary-accruals-page-header" className={cn('flex flex-col gap-3.5 md:gap-4', className)}>
            <div className="flex flex-col gap-1">
                <h1 className="font-display text-[26px] font-bold tracking-[-0.4px] text-ink">Начисление зарплаты</h1>
                <p className="font-ui text-sm text-ink-muted">{subtitle}</p>
            </div>

            {/* Десктоп: Scope Controls (табы + Select) слева, Period Chip + кнопка справа. */}
            <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
                <div className="flex items-center gap-2.5">
                    {directionTabs}
                    {departmentSelect}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <PeriodPicker period={period} onPeriodChange={onPeriodChange} isClosed={isPeriodClosed} />
                    {accrueAllButton}
                </div>
            </div>

            {/* Мобильный: табы + Select стопкой, затем Period Row (пилюля + чип), затем кнопка. */}
            <div className="flex flex-col gap-2 md:hidden">
                {directionTabs}
                {departmentSelect}
            </div>
            <div className="flex items-center gap-2 md:hidden">
                {periodPill}
                <PeriodPicker period={period} onPeriodChange={onPeriodChange} isClosed={isPeriodClosed} />
            </div>
            <div className="md:hidden">{accrueAllButton}</div>
        </div>
    )
}

export { PageHeader }
