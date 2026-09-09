import type { ShopStore } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw.ts'
import { PeriodPicker } from '@/shared/ui-kit/organisms/PeriodPicker.tsx'

import type { ShopCategoryRef } from '../../model/shop/categoryTree.ts'
import { ShopCategoryTreeSelect } from './CategoryTreeSelect/index.ts'
import { PeriodStatusBadge } from '../PeriodStatusBadge.tsx'
import { ShopWarehouseSelect } from './WarehouseSelect.tsx'

export type ShopGoodsTurnoverFilterRowProps = {
    warehouses: ShopStore[]
    warehouseId: string | null
    onWarehouseChange: (warehouseId: string) => void
    categories: ShopCategoryRef[]
    categoryId: string | null
    onCategoryChange: (categoryId: string | null) => void
    period: string
    onPeriodChange: (period: string) => void
    maxPeriod: string
    isClosed: boolean
    className?: string
}

/**
 * Портировано из `../FilterRow.tsx` (направление `service`) — тот же ряд фильтров (склад +
 * категория слева, период + бейдж статуса справа, с перегруппировкой в два ряда на мобайле), см.
 * комментарий оригинала за полным описанием раскладки. `PeriodStatusBadge` переиспользуется как
 * есть — она не завязана на направление/тип id, только на `isClosed`.
 */
export function ShopGoodsTurnoverFilterRow({
    warehouses,
    warehouseId,
    onWarehouseChange,
    categories,
    categoryId,
    onCategoryChange,
    period,
    onPeriodChange,
    maxPeriod,
    isClosed,
    className,
}: ShopGoodsTurnoverFilterRowProps) {
    return (
        <div
            data-slot="shop-goods-turnover-filter-row"
            className={cn('flex flex-col gap-2 md:flex-row md:items-center md:gap-4', className)}
        >
            <div className="order-2 flex w-full items-center gap-2 md:order-1 md:w-auto md:gap-3">
                <ShopWarehouseSelect warehouses={warehouses} selectedWarehouseId={warehouseId} onSelect={onWarehouseChange} />
                <ShopCategoryTreeSelect categories={categories} selectedId={categoryId} onChange={onCategoryChange} />
            </div>

            <div className="hidden md:block md:flex-1" aria-hidden />

            <div className="order-1 flex w-full items-center gap-2 md:order-3 md:w-auto md:gap-3">
                <PeriodPicker period={period} onChange={onPeriodChange} maxPeriod={maxPeriod} />
                <PeriodStatusBadge isClosed={isClosed} />
            </div>
        </div>
    )
}
