import { CircleCheck, Wallet, X } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'

import { pluralizeDocuments } from '../model/accrualView.ts'

export type SelectionBarProps = {
    selectedCount: number
    onClear: () => void
    onAccrueSelected: () => void
    className?: string
}

/**
 * Pencil `cfNlL` (P1.2): `brand-soft`/`brand-border` pill above the table — "Выбрано N" на
 * левой стороне, «Начислить выбранным» справа. Та же геометрия, что `SelectionBar`
 * features/SalesPlan (`LSV9W`), пересобрана здесь — кросс-импорт между features запрещён
 * (frontend/CLAUDE.md). Рендерится страницей только пока `selectedCount > 0`.
 */
function SelectionBar({ selectedCount, onClear, onAccrueSelected, className }: SelectionBarProps) {
    return (
        <div
            data-slot="selection-bar"
            className={cn(
                'flex items-center justify-between gap-3 rounded-[10px] border border-brand-border bg-brand-soft px-4 py-2.5',
                className,
            )}
        >
            <div className="flex items-center gap-2.5">
                <CircleCheck className="size-4 shrink-0 text-ok-ink" />
                <span className="font-ui text-[13px] font-medium text-ok-ink">
                    Выбрано {selectedCount} {pluralizeDocuments(selectedCount)}
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onClear}
                    className="text-ink-muted [&_svg]:text-ink-muted"
                >
                    <X />
                    Снять выбор
                </Button>
                <Button type="button" onClick={onAccrueSelected}>
                    <Wallet />
                    Начислить выбранным
                </Button>
            </div>
        </div>
    )
}

export { SelectionBar }
