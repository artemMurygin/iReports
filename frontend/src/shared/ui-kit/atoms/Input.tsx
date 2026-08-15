import * as React from 'react'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `tNjjM` (`ERP/Atom/Input`) — 36px tall text
 * control: `surface` background, 1px `hairline` border, 8px radius, 12px horizontal padding,
 * 13px/500 `ink` value text (`Roboto`). Every `Control` frame in the salary schema form (`Field
 * Отдел`'s `Value`, `Field Название`'s `Value`, the rule card's `Название правила`) shares this
 * exact box — the select trigger (`atoms/Select.tsx`) is styled to match it 1:1 so the two atoms
 * sit flush in the same form.
 *
 * Bare `<input>` (not a `Field` with a built-in label) — every usage in the mockup pairs it with
 * its own `Label` text above, composed by the consumer, mirroring how `Checkbox`/`Avatar` stay
 * label-less atoms too.
 */
function Input({ className, ...props }: React.ComponentProps<'input'>) {
    return (
        <input
            data-slot="input"
            className={cn(
                'flex h-9 w-full items-center rounded-[8px] border border-hairline bg-surface px-3 font-ui text-[13px] font-medium text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-faint focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-faint',
                className,
            )}
            {...props}
        />
    )
}

export { Input }
