import { Check, Minus } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `j8kclS` (`ERP/Atom/Checkbox`) — 16x16,
 * 4px radius, 1px inner-aligned border. Two states appear in the design as per-instance
 * overrides of the shadcn `Checkbox/Checked` base (`WcOfl`): checked (`brand-strong` fill +
 * border, white `check`) — see `Q2R6J`'s `Hh7eH`/mobile `IRX80` instances — and indeterminate
 * (`surface` fill, `hairline` border, `ink-muted` `minus`) — see `WWw3l`'s `h0O7y0` "Select
 * All" instance when only some rows are picked. Unchecked (no instance in the design, plain
 * `surface`/`hairline` box with no icon) is inferred from the same base.
 *
 * Built on `radix-ui`'s `Checkbox` primitive (already used elsewhere in the kit via `Slot`,
 * see `atoms/Button.tsx`) rather than a plain `<button>`, so it gets correct `role="checkbox"`/
 * `aria-checked`/keyboard behavior for free — this is a `shared/ui-kit` atom with no business
 * logic of its own (selection state lives in `features/SalesPlan/model/useSalesPlanSelection`).
 */
export type CheckboxProps = {
    checked: boolean | 'indeterminate'
    onCheckedChange?: (checked: boolean) => void
    'aria-label'?: string
    className?: string
}

function Checkbox({ checked, onCheckedChange, className, ...props }: CheckboxProps) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            checked={checked}
            onCheckedChange={(value) => onCheckedChange?.(value === true)}
            className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-surface outline-none transition-colors',
                'data-[state=checked]:border-brand-strong data-[state=checked]:bg-brand-strong',
                'data-[state=indeterminate]:border-hairline data-[state=indeterminate]:bg-surface',
                'focus-visible:ring-2 focus-visible:ring-brand/40',
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator className="flex items-center justify-center">
                {checked === 'indeterminate' ? (
                    <Minus className="size-[11px] text-ink-muted" strokeWidth={2.5} />
                ) : (
                    <Check className="size-[11px] text-white" strokeWidth={3} />
                )}
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    )
}

export { Checkbox }
