import * as React from 'react'

import { cn } from '@/shared/lib/tw'

/**
 * Многострочный аналог `atoms/Input.tsx` — тот же бокс (surface/hairline/ink,
 * 8px radius, focus-visible ring на brand), но `<textarea>` вместо `<input>` для
 * многострочного текста (например, обязательный комментарий корректировки строки
 * начисления, Фаза 9 docs/payroll-closing-and-accrual). `rows` по умолчанию 3,
 * как в большинстве форм с комментарием; высота растёт по числу строк, а не
 * фиксирована — в отличие от `h-9` у `Input`.
 *
 * Bare `<textarea>` (не `Field` со встроенным лейблом) — как и `Input`, каждое
 * использование сопровождается своим `Label` сверху, который собирает потребитель.
 */
function Textarea({ className, rows = 3, ...props }: React.ComponentProps<'textarea'>) {
    return (
        <textarea
            data-slot="textarea"
            rows={rows}
            className={cn(
                'flex w-full items-center rounded-[8px] border border-hairline bg-surface px-3 py-2 font-ui text-[13px] font-medium text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-faint focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-faint',
                className,
            )}
            {...props}
        />
    )
}

export { Textarea }
