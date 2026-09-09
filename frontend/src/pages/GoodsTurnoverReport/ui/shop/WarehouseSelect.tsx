import { Warehouse } from 'lucide-react'
import type { ShopStore } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/ui-kit/atoms/Select'

type Props = {
    warehouses: ShopStore[]
    selectedWarehouseId: string | null
    onSelect: (warehouseId: string) => void
    className?: string
}

/**
 * Портировано из `../WarehouseSelect.tsx` (направление `service`) под справочник складов МойСклад
 * (`ShopStore`, `GET /v1/shop/warehouse/stores`) — единственное отличие от оригинала: id склада
 * строковый (MoySklad UUID), а не числовой (RemOnline id), поэтому `value`/`onValueChange` не
 * конвертируют через `String()`/`Number()` — см. комментарий оригинала за полным описанием
 * визуального паттерна (десктопный/мобильный триггеры).
 */
export function ShopWarehouseSelect({ warehouses, selectedWarehouseId, onSelect, className }: Props) {
    const selectedName = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId)?.name ?? '—'

    const options = (
        <SelectContent>
            {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                </SelectItem>
            ))}
        </SelectContent>
    )

    return (
        <>
            <div data-slot="shop-warehouse-select-desktop" className={cn('hidden md:flex', className)}>
                <Select value={selectedWarehouseId ?? undefined} onValueChange={onSelect}>
                    <SelectTrigger className="h-auto w-auto justify-between gap-2 rounded-[10px] px-3 py-[9px]">
                        <span className="flex items-center gap-1">
                            <span className="font-ui text-[13px] font-normal text-ink-muted">Склад ·</span>
                            <span className="font-ui text-[13px] font-semibold text-ink">{selectedName}</span>
                        </span>
                    </SelectTrigger>
                    {options}
                </Select>
            </div>

            <div data-slot="shop-warehouse-select-mobile" className={cn('flex md:hidden', className)}>
                <Select value={selectedWarehouseId ?? undefined} onValueChange={onSelect}>
                    <SelectTrigger className="h-auto w-auto items-center gap-1.5 rounded-[7px] px-2.5 py-1.5">
                        <Warehouse className="size-[13px] shrink-0 text-ink-muted" />
                        <span className="font-ui text-xs font-medium text-ink">{selectedName}</span>
                    </SelectTrigger>
                    {options}
                </Select>
            </div>
        </>
    )
}
