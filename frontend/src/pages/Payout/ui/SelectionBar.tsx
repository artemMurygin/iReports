import { Banknote, CircleCheck, X } from 'lucide-react'

import { pluralizeEmployees } from '@/features/Payout'
import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'

export type SelectionBarProps = {
    selectedCount: number
    totalAmount: number
    onClear: () => void
    onPaySelected: () => void
    className?: string
}

/** Pencil `OKluo` (Selection Bar): «Выплатить выбранным (N) · X ₽» — тот же приём, что
 * `features/SalaryAccruals/ui/SelectionBar.tsx`, задублирован здесь (кросс-импорт между
 * features запрещён, а этот компонент специфичен для страницы, а не отдельная фича). */
function SelectionBar({ selectedCount, totalAmount, onClear, onPaySelected, className }: SelectionBarProps) {
    return (
        <div
            data-slot="payout-selection-bar"
            className={cn(
                'flex items-center justify-between gap-3 rounded-[10px] border border-brand-border bg-brand-soft px-4 py-2.5',
                className,
            )}
        >
            <div className="flex items-center gap-2.5">
                <CircleCheck className="size-4 shrink-0 text-ok-ink" />
                <span className="font-ui text-[13px] font-medium text-ok-ink">
                    Выбрано {selectedCount} {pluralizeEmployees(selectedCount)} · {formatCurrency(totalAmount)}
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="secondary" onClick={onClear} className="text-ink-muted [&_svg]:text-ink-muted">
                    <X />
                    Снять выбор
                </Button>
                <Button type="button" onClick={onPaySelected}>
                    <Banknote />
                    Выплатить выбранным ({selectedCount})
                </Button>
            </div>
        </div>
    )
}

export { SelectionBar }
