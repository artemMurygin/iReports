import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { OrderTypeResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

export type OrderTypeSelectProps = {
    /** Id типов заказов RoApp, выбранных для строки — `[]` = "все типы" (см.
     * `contracts/commands/sales-plan.ts`, `SalesPlan.orderTypeIds`). */
    value: number[]
    onValueChange: (value: number[]) => void
    orderTypes: OrderTypeResponse[]
    isLoading?: boolean
    'aria-label': string
    className?: string
}

function triggerLabel(value: number[], orderTypes: OrderTypeResponse[]): string {
    if (value.length === 0) return 'Все типы'
    if (value.length === 1) return orderTypes.find((orderType) => orderType.id === value[0])?.name ?? '1 тип'
    return `Типов: ${value.length}`
}

/**
 * Мультиселект "типы заказов" одной строки плана (`EditPlanTableRow`) — по образцу
 * `atoms/Popover.tsx` + `atoms/Checkbox.tsx` (checkbox-список поверх поповера, а не дерево, как у
 * `SalaryRuleForm/CategoryField/CategoryCombobox` — справочник `RoappOrderType` плоский, без
 * иерархии, см. `orderTypeSchema` в `contracts/commands/report.ts`). Пустой выбор — "все типы" —
 * закрывает мультиселект в дефолтное поведение без миграции старых строк плана (Фаза 4,
 * docs/service-plan-salary-rule-order-category-filter).
 */
export function OrderTypeSelect({ value, onValueChange, orderTypes, isLoading, className, ...props }: OrderTypeSelectProps) {
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
                    aria-label={props['aria-label']}
                    className={cn(
                        'flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-[6px] border border-hairline bg-surface px-2.5 font-ui text-[13px] font-medium text-ink outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50',
                        className,
                    )}
                >
                    <span className="truncate">{isLoading ? 'Загрузка...' : triggerLabel(value, orderTypes)}</span>
                    <ChevronDown className={cn('size-[13px] shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
                </button>
            </PopoverTrigger>

            <PopoverContent align="start" className="flex w-[240px] flex-col gap-2 p-2">
                {orderTypes.length === 0 ? (
                    <p className="px-1.5 py-1 font-ui text-xs text-ink-muted">Справочник типов заказов пуст</p>
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
