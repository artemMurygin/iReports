import { Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Переключатель on/off — тот же токенный набор и приём (`radix-ui`'s unified package, уже
 * использованный `atoms/Checkbox.tsx`/`atoms/Button.tsx` через `Slot`), что и у остальных
 * атомов кита: `brand-strong` заливка во включённом состоянии, `hairline`-обведённый `canvas`
 * в выключенном — тот же язык, что у `Checkbox`'s checked/unchecked. Нет отдельного инстанса в
 * Pencil-макете (страница настроек со списком сотрудников не в дизайне) — стилизован по
 * аналогии с `Checkbox`, а не собственным примитивом с нуля (frontend/CLAUDE.md: не изобретать
 * свой переключатель поверх голого `<button>`, когда в ките уже есть `radix-ui` для этого).
 */
export type SwitchProps = {
    checked: boolean
    onCheckedChange?: (checked: boolean) => void
    disabled?: boolean
    'aria-label'?: string
    className?: string
}

function Switch({ checked, onCheckedChange, className, ...props }: SwitchProps) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            checked={checked}
            onCheckedChange={onCheckedChange}
            className={cn(
                'peer inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full border border-transparent outline-none transition-colors',
                'bg-canvas data-[state=checked]:bg-brand-strong',
                'ring-1 ring-hairline data-[state=checked]:ring-brand-strong',
                'focus-visible:ring-2 focus-visible:ring-brand/40',
                'disabled:pointer-events-none disabled:opacity-50',
                className,
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className={cn(
                    'pointer-events-none block size-[16px] shrink-0 translate-x-[2px] rounded-full bg-white shadow-sm transition-transform',
                    'data-[state=checked]:translate-x-[16px]',
                )}
            />
        </SwitchPrimitive.Root>
    )
}

export { Switch }
