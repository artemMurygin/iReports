import { Search } from 'lucide-react'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import {
    SERVICE_VARIANT_FILTER_OPTIONS,
    type ServiceVariantFilter,
} from '@/kernel/serviceVariant.ts'
import { pluralizeServices } from '@/features/ServicesTable/model/pluralizeServices.ts'
import { fmtMoney } from '@/features/ServicesTable/model/format.ts'
import { ColumnsPopover } from '@/features/ServicesTable/ui/ColumnsPopover.tsx'
import type { ColumnVisibility, OptionalColumnId } from '@/features/ServicesTable/model/columns.ts'

const VARIANT_OPTIONS: SegmentedControlOption<ServiceVariantFilter>[] = SERVICE_VARIANT_FILTER_OPTIONS.map(
    (value) => ({ value, label: value }),
)

type Props = {
    totalServicesCount: number
    totalRevenue: number
    search: string
    onSearchChange: (value: string) => void
    variantFilter: ServiceVariantFilter
    onVariantFilterChange: (value: ServiceVariantFilter) => void
    columnVisibility: ColumnVisibility
    onColumnToggle: (id: OptionalColumnId, checked: boolean) => void
}

/** Header Block таблицы услуг (Pencil: `h7eHG` → `tmW21` "Table Section") — заголовок+подзаголовок
 * слева, Actions Row (вкладки "Вариант" → поиск → колонки) справа. Общий и для десктоп-таблицы, и
 * для мобильного списка карточек (поиск и вкладки применяются к обеим поверхностям одинаково). */
export function ServicesTableHeader({
    totalServicesCount,
    totalRevenue,
    search,
    onSearchChange,
    variantFilter,
    onVariantFilterChange,
    columnVisibility,
    onColumnToggle,
}: Props) {
    return (
        <div className="flex flex-col gap-3 border-b border-hairline p-5 md:flex-row md:items-center md:justify-between md:gap-4">
            <div>
                <h3 className="font-ui text-base font-bold text-ink">Услуги</h3>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                    {pluralizeServices(totalServicesCount)} · выручка {fmtMoney(totalRevenue)}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
                <SegmentedControl
                    aria-label="Вариант"
                    options={VARIANT_OPTIONS}
                    value={variantFilter}
                    onValueChange={onVariantFilterChange}
                />
                <div className="relative w-full sm:w-[210px]">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-[14px] -translate-y-1/2 text-ink-faint" />
                    <Input
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Поиск по услуге"
                        className="pl-8"
                    />
                </div>
                <ColumnsPopover visibility={columnVisibility} onToggle={onColumnToggle} />
            </div>
        </div>
    )
}
