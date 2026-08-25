import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { OrderTypeResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

export type OrderTypeFieldProps = {
    /** Id типов заказов RoApp, выбранных для правила — `[]` = "все типы" (см.
     * `RuleDraft.orderTypeIds`, `contracts/commands/salary-rule.ts`'s `orderTypeIds`). */
    value: number[]
    onValueChange: (value: number[]) => void
    orderTypes: OrderTypeResponse[]
    isLoading?: boolean
    error?: string | null
    className?: string
}

function triggerLabel(value: number[], orderTypes: OrderTypeResponse[]): string {
    if (value.length === 0) return 'Все типы'
    if (value.length === 1) return orderTypes.find((orderType) => orderType.id === value[0])?.name ?? '1 тип'
    return `Типов: ${value.length}`
}

/**
 * Мультиселект "типы заказов" (`OrderPayed`/`ServiceCompleted`, Фаза 5,
 * docs/service-plan-salary-rule-order-category-filter) — по образцу
 * `features/SalesPlan/ui/EditPlanModal/ui/OrderTypeSelect.tsx` (та же задача, план продаж, Фаза 4):
 * checkbox-список поверх поповера, а не дерево, как у соседнего `CategoryField` — справочник
 * `RoappOrderType` плоский, без иерархии (см. `orderTypeSchema` в `contracts/commands/report.ts`).
 * Своя копия, не импорт `SalesPlan`'s компонента — кросс-импорты между features запрещены
 * (frontend/CLAUDE.md). Пустой выбор — "все типы" — включая ошибку загрузки в подписи триггера
 * (как `CategoryCombobox`), т.к. поле необязательное и не участвует в `resolveRuleDraft`'s
 * required-полях.
 */
export function OrderTypeField({ value, onValueChange, orderTypes, isLoading, error, className }: OrderTypeFieldProps) {
    const [open, setOpen] = useState(false)

    function toggle(id: number) {
        onValueChange(value.includes(id) ? value.filter((selectedId) => selectedId !== id) : [...value, id])
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={isLoading}
                    className={cn(
                        'flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-[8px] border border-hairline bg-surface px-3 font-ui text-sm text-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50',
                        className,
                    )}
                >
                    <span className="truncate">
                        {isLoading ? 'Загрузка...' : error ? 'Не удалось загрузить' : triggerLabel(value, orderTypes)}
                    </span>
                    <ChevronDown className={cn('size-[15px] shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
                </button>
            </PopoverTrigger>

            <PopoverContent align="start" className="flex w-[280px] flex-col gap-2 p-2">
                {orderTypes.length === 0 ? (
                    <p className="px-1.5 py-1 font-ui text-xs text-ink-muted">
                        {error ? 'Не удалось загрузить справочник типов заказов' : 'Справочник типов заказов пуст'}
                    </p>
                ) : (
                    <div className="flex max-h-[240px] flex-col gap-0.5 overflow-y-auto">
                        {orderTypes.map((orderType) => (
                            <label
                                key={orderType.id}
                                className="flex cursor-pointer items-center gap-2 rounded-[6px] px-1.5 py-1.5 font-ui text-[13px] text-ink hover:bg-canvas"
                            >
                                <Checkbox checked={value.includes(orderType.id)} onCheckedChange={() => toggle(orderType.id)} />
                                <span className="truncate">{orderType.name}</span>
                            </label>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2">
                    <p className="font-ui text-[11px] leading-[1.3] text-ink-faint">Пусто — учитываются все типы</p>
                    <button
                        type="button"
                        onClick={() => onValueChange([])}
                        className="shrink-0 font-ui text-xs font-semibold text-ok-ink hover:underline"
                    >
                        Сбросить
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
