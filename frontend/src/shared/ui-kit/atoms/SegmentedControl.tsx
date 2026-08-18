import { cn } from '@/shared/lib/tw'

export type SegmentedControlOption<T extends string> = {
    value: T
    label: string
    disabled?: boolean
}

export type SegmentedControlProps<T extends string> = {
    options: SegmentedControlOption<T>[]
    value: T
    onValueChange: (value: T) => void
    /** `'horizontal'` (default) is the mockup's usual side-by-side pill row. `'vertical'` stacks
     * one full-width row per option instead — Pencil node `I3Am6j` (`Блок · База начисления`,
     * mobile) uses this for the 3-option "База начисления" control, where the horizontal layout's
     * `flex-1` tabs would squeeze "Маржа - начисление инженера" until it overflows a phone-width
     * card (see `SalaryRulesRuleFormCard.tsx`, Фаза 5). Same active/inactive pill styling either
     * way, just the axis flips. */
    orientation?: 'horizontal' | 'vertical'
    className?: string
    'aria-label'?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node inside `tSYIw` (`Зарплатное правило ·
 * Создание (Сервис)`) → `Блок · Направление` → `Direction Tabs` — a two-option "Сервис/Магазин"
 * switch: `canvas`-filled track with a `hairline` border, 8px radius, 3px inner padding, 2px gap
 * between the two flex-1 tabs. The active tab is a `surface` pill with its own `hairline` border
 * and semibold `ink` label; the inactive tab is transparent with medium `ink-muted` label.
 *
 * Generic over the option's `value` type (not hardcoded to two Сервис/Магазин strings) so it can
 * be reused for any two-or-more-option switch sharing this look, matching how the mockup itself
 * only ever pairs this shape with a small closed set of options (`SalesPlanPage`'s inline
 * Direction Tabs — `pages/SalesPlan/ui/PageHeader.tsx` — implements the exact same visual pattern
 * ad hoc; this atom is the shared version new pages should build on instead).
 */
function SegmentedControl<T extends string>({
    options,
    value,
    onValueChange,
    orientation = 'horizontal',
    className,
    ...props
}: SegmentedControlProps<T>) {
    const vertical = orientation === 'vertical'

    return (
        <div
            data-slot="segmented-control"
            role="tablist"
            aria-label={props['aria-label']}
            aria-orientation={orientation}
            className={cn(
                'flex gap-[2px] rounded-[8px] border border-hairline bg-canvas p-[3px]',
                vertical ? 'flex-col' : 'items-center',
                className,
            )}
        >
            {options.map((option) => {
                const active = option.value === value

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        disabled={option.disabled}
                        onClick={() => onValueChange(option.value)}
                        data-state={active ? 'active' : 'inactive'}
                        className={cn(
                            'flex items-center justify-center rounded-[6px] px-3 py-[6px] font-ui text-[13px] whitespace-nowrap transition-colors select-none disabled:cursor-not-allowed disabled:opacity-50',
                            vertical ? 'w-full' : 'flex-1',
                            active
                                ? 'border border-hairline bg-surface font-semibold text-ink'
                                : 'border border-transparent font-medium text-ink-muted hover:text-ink',
                        )}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}

export { SegmentedControl }
