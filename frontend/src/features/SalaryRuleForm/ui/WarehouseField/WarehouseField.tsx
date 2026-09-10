import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

export type WarehouseFieldWarehouse = {
    /** `number` for service (RoApp/RemOnline warehouse id, `WarehouseResponse.id`) or `string` for
     * shop (MoySklad UUID, `ShopStore.id`) — compared/reported as `String(id)`, see below. */
    id: string | number
    name: string
}

export type WarehouseFieldProps = {
    /** Always a string, both directions — mirrors `RuleDraft.warehouseId` (`model/ruleDraft.ts`):
     * `''` means "not selected yet", never a valid warehouse (the field is required, see below). */
    value: string
    onValueChange: (value: string) => void
    warehouses: WarehouseFieldWarehouse[]
    isLoading?: boolean
    error?: string | null
    className?: string
}

/**
 * Implements FR4 of add-department-head-salary-rules.
 *
 * Поле выбора склада для правила `DepartmentTurnoverBonus` ("План оборачиваемости склада", FR4) —
 * обязательное: у формы нет валидного состояния без выбора (оборачиваемость скоуплена по складу,
 * автоматической привязки сотрудник→склад нет — proposal.md FR4). В отличие от соседних
 * `CategoryField`/`OrderTypeField` компонент поэтому не даёт способа сбросить выбор в "пусто"/"все
 * склады" — реальную валидацию пустого значения делает `model/ruleAwards.ts`'s
 * `buildDepartmentTurnoverBonusConfig` (`errors.warehouseId = 'Выберите склад'`), этот компонент
 * лишь не предлагает такой опции визуально.
 *
 * Визуально воспроизводит паттерн поля «Склад» карточки правила FR4 (Pencil `design/
 * sallary-first-iteration.pen`, node `WdQo0` → `Cp19t` → `lupq1`, инстанс `M9wrR` молекулы
 * `ERP/Molecule/Field`/`PM7Om`: Label + `ERP/Atom/Input`-триггер с trailing `chevron-down` + Hint) —
 * тот же триггер-паттерн (`h-9`, `rounded-[8px]`, `border-hairline`, `bg-surface`, `px-3`, `font-ui
 * text-[13px] font-medium text-ink`), что уже применён у `CategoryField`'s `CategoryCombobox`
 * (`ui/CategoryField/ui/categoryOverlay.ts`'s `CATEGORY_TRIGGER_CLASS`). Справочник складов —
 * плоский список без иерархии (в отличие от категорий), поэтому попап — простой список без
 * дерева/поиска, как у `OrderTypeField`, но одиночный выбор (одна выбранная строка с чекмарком), а
 * не мультиселект с чекбоксами.
 *
 * Label/Hint из макета рендерит вызывающая сторона (см. `RuleFormCardFields.tsx`'s обёртку вокруг
 * `CategoryField` — тот же паттерн: `<label>` + поле + `FieldError` снаружи), этот компонент — сам
 * `ERP/Atom/Input`-контрол.
 */
export function WarehouseField({ value, onValueChange, warehouses, isLoading, error, className }: WarehouseFieldProps) {
    const [open, setOpen] = useState(false)
    const selected = warehouses.find((warehouse) => String(warehouse.id) === value)

    function pick(id: string | number) {
        onValueChange(String(id))
        setOpen(false)
    }

    function triggerLabel(): string {
        if (isLoading) return 'Загрузка...'
        if (error) return 'Не удалось загрузить'
        return selected?.name ?? 'Выберите склад'
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={isLoading}
                    className={cn(
                        'flex h-9 w-full items-center justify-between gap-2 rounded-[8px] border border-hairline bg-surface px-3 font-ui text-[13px] font-medium text-ink outline-none transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-faint',
                        !selected && !isLoading && !error && 'font-normal text-ink-faint',
                        className,
                    )}
                >
                    <span className="truncate">{triggerLabel()}</span>
                    <ChevronDown
                        className={cn('size-[15px] shrink-0 text-ink-muted transition-transform', open && 'rotate-180')}
                    />
                </button>
            </PopoverTrigger>

            <PopoverContent align="start" className="flex w-[280px] flex-col gap-0.5 p-1.5">
                {warehouses.length === 0 ? (
                    <p className="px-1.5 py-1 font-ui text-xs text-ink-muted">
                        {error ? 'Не удалось загрузить справочник складов' : 'Справочник складов пуст'}
                    </p>
                ) : (
                    <div className="flex max-h-[280px] flex-col gap-0.5 overflow-y-auto">
                        {warehouses.map((warehouse) => {
                            const isSelected = String(warehouse.id) === value
                            return (
                                <button
                                    key={warehouse.id}
                                    type="button"
                                    onClick={() => pick(warehouse.id)}
                                    className="flex w-full items-center gap-1.5 rounded-[8px] px-2.5 py-[7px] text-left font-ui text-[13px] text-ink transition-colors hover:bg-canvas"
                                >
                                    <span className="flex size-4 shrink-0 items-center justify-center">
                                        {isSelected && <Check className="size-3.5 text-brand-strong" />}
                                    </span>
                                    <span className="truncate">{warehouse.name}</span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
