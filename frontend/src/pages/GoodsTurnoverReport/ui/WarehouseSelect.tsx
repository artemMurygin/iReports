import { Warehouse } from 'lucide-react'
import type { WarehouseResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/shared/ui-kit/atoms/Select'

type Props = {
    warehouses: WarehouseResponse[]
    selectedWarehouseId: number | null
    onSelect: (warehouseId: number) => void
    className?: string
}

/**
 * Filter Row страницы `/goods-turnover-report` (openspec/changes/service-turnover-report, задача
 * 16; ui-design.md "Новые компоненты UI Kit" → `Warehouse Select`) — переключение склада. По
 * итогам ревью макета (`architecture.md`: «пользователь: сделай селект, а не таб») это
 * select/combobox-поле поверх уже используемого в проекте `shared/ui-kit/atoms/Select`
 * (radix-ui `Select`), а НЕ `SegmentedControl`/Tabs — список складов заранее неизвестной длины,
 * не ограничен фиксированным числом вкладок (проверено тестом на список из 5 складов).
 *
 * Рендерится дважды — десктопный триггер (`Pencil`: узел `M6ZfP` в `WvSO6`, подпись «Склад ·» +
 * значение + `chevron-down`, тот же визуальный паттерн, что и ещё не заведённый в `uDEum` "Field
 * Период") и мобильный `Chip`-триггер (узел `Yu5pP` в `yDBTb`: иконка `warehouse` + значение +
 * `chevron-down`, без подписи) — `hidden md:flex`/`flex md:hidden`, тот же приём, что
 * `pages/EmployeeBalance/ui/BalanceFilters.tsx` (см. комментарий в `WarehouseSelect.spec.tsx`),
 * а не один адаптивный набор классов на одном дереве: оба узла в макете — самостоятельные
 * композиции с разной структурой (подпись+значение vs иконка+значение), а не одна и та же
 * разметка, сжатая по ширине.
 *
 * Оба триггера — независимые контролируемые `Select`-инстансы с общим `value`/`onValueChange`
 * (не два `SelectTrigger` в одном `Select.Root` — Radix ожидает единственный триггер на корень
 * для позиционирования попапа). Мобильный чип использует чуть больший `chevron-down` (15px, из
 * самого `SelectTrigger`), чем в макете (13px) — переиспользование общего примитива вместо
 * ре-имплементации ради 2px разницы в иконке.
 */
export function WarehouseSelect({ warehouses, selectedWarehouseId, onSelect, className }: Props) {
    const selectedName = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId)?.name ?? '—'
    const value = selectedWarehouseId != null ? String(selectedWarehouseId) : undefined

    function handleValueChange(next: string) {
        onSelect(Number(next))
    }

    const options = (
        <SelectContent>
            {warehouses.map((warehouse) => (
                <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                    {warehouse.name}
                </SelectItem>
            ))}
        </SelectContent>
    )

    return (
        <>
            <div data-slot="warehouse-select-desktop" className={cn('hidden md:flex', className)}>
                <Select value={value} onValueChange={handleValueChange}>
                    <SelectTrigger className="h-auto w-auto justify-between gap-2 rounded-[10px] px-3 py-[9px]">
                        <span className="flex items-center gap-1">
                            <span className="font-ui text-[13px] font-normal text-ink-muted">Склад ·</span>
                            <span className="font-ui text-[13px] font-semibold text-ink">{selectedName}</span>
                        </span>
                    </SelectTrigger>
                    {options}
                </Select>
            </div>

            <div data-slot="warehouse-select-mobile" className={cn('flex md:hidden', className)}>
                <Select value={value} onValueChange={handleValueChange}>
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
