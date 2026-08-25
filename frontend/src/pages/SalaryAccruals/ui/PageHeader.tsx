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
    /** Название выбранного отдела для Dept Row — `null` и при выбранном «Все отделы», и пока
     * справочник ещё не загрузился; обе ветки в Dept Row показывают запасной текст «Все отделы». */
    departmentName: string | null
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
 * Pencil `LvW0I`/`Ed0FF` (десктоп) и `DtPgO` (мобильный) — редизайн шапки списка начислений:
 * Icon Box (`Wallet`, `brand-soft`) слева от заголовка «Начисление зарплаты» (в ед. числе —
 * было «Начисления»); статус-пилюля периода из старой версии (`cfNlL`) на десктопе убрана
 * полностью (нигде текстом не дублируется), но на мобильном (`DtPgO`) остаётся — в новой
 * «Period Row» рядом с Period Chip.
 *
 * Direction Tabs старой версии стали «Scope Controls»: добавлен Select «Отдел» (иконка
 * `building-2`, пункт «Все отделы» первым — фильтр по отделу, которого не было в исходном
 * макете списка, но есть на `/salaries`, см. `SalaryReportFiltersV2`).
 *
 * Dept Row под заголовком показывает название отдела (иконка + `font-display` полужирным,
 * «Все отделы» при `departmentId === null`) только пока месяц НЕ закрыт (`Ed0FF`'s `AGGZs`) —
 * там нет таблицы ниже, которая бы иначе дала этот контекст; на закрытом месяце (`LvW0I`'s
 * `nQBE9`) Dept Row — просто подпись, имя отдела уже видно в самом Select. На мобильном
 * (`DtPgO`) название отдела в Dept Row есть всегда, а подпись — отдельной строкой ниже,
 * независимо от статуса периода.
 */
function PageHeader({
    direction,
    onDirectionChange,
    departments,
    isDepartmentsLoading,
    departmentId,
    onDepartmentIdChange,
    departmentName,
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
            <div className="flex flex-col gap-[7px]">
                <div className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft md:size-8 md:rounded-[9px]">
                        <Wallet className="size-4 text-brand-strong md:size-[18px]" />
                    </span>
                    <h1 className="font-display text-[22px] font-bold tracking-[-0.4px] text-ink md:text-[28px] md:tracking-[-0.5px]">
                        Начисление зарплаты
                    </h1>
                </div>

                {/* Мобильный: имя отдела всегда в Dept Row, подпись — отдельной строкой (DtPgO). */}
                <div className="flex items-center gap-1.5 md:hidden">
                    <Building2 className="size-[15px] shrink-0 text-brand-strong" />
                    <span className="font-display text-[17px] font-bold tracking-[-0.2px] text-ink">
                        {departmentName ?? 'Все отделы'}
                    </span>
                </div>
                <p className="font-ui text-[12.5px] leading-[1.35] text-ink-muted md:hidden">{subtitle}</p>

                {/* Десктоп: имя отдела в Dept Row только пока месяц не закрыт (Ed0FF); на
                 * закрытом месяце — просто подпись (LvW0I), имя отдела уже видно в Select. */}
                <div className="hidden items-center gap-2 md:flex">
                    {!isPeriodClosed && (
                        <>
                            <Building2 className="size-4 shrink-0 text-brand-strong" />
                            <span className="font-display text-lg font-bold tracking-[-0.2px] text-ink">
                                {departmentName ?? 'Все отделы'}
                            </span>
                            <span className="font-display text-base font-bold text-ink-faint">·</span>
                        </>
                    )}
                    <span className="font-ui text-[13px] text-ink-muted">{subtitle}</span>
                </div>
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
