import { Slider as SliderPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node inside `tSYIw` → `Поле · Базовый процент
 * (слайдер)` → `Слайдер` — an 18px-tall single-thumb track: 6px `hairline` track (3px radius),
 * `brand` fill up to the thumb, and an 18px `surface`-filled circular thumb with a 2px `brand`
 * border. Bare slider control (no label/value badge/min-max scale) — those are composed by the
 * consumer (`pages/SalaryRules/ui/PercentSliderField.tsx`), same division of responsibility as
 * `Input`/`Select` staying label-less atoms.
 *
 * Built on `radix-ui`'s `Slider` primitive for correct drag/keyboard/ARIA behavior, single value
 * only (`value`/`onValueChange` take/give a single number, not the primitive's array form) since
 * every usage in the mockup (Базовый процент 1–100%) is a single-thumb slider.
 *
 * `onValueCommit` (Фаза 7 «Редактирование дня», docs/employee-work-schedule) — optional, separate
 * from `onValueChange`: часы смены в поповере графика сохраняются запросом на сервер, а
 * `onValueChange` у Radix стреляет на каждый пиксель драга — без отдельного колбэка «отпустили
 * ползунок» пришлось бы либо слать запрос на каждое промежуточное значение, либо городить
 * дебаунс здесь, в атоме. `PercentSliderField` его не передаёт (там значение живёт в форме,
 * сохраняемой отдельной кнопкой) — проп опционален и не ломает существующий вызов.
 */
export type SliderProps = {
    value: number
    onValueChange: (value: number) => void
    onValueCommit?: (value: number) => void
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    className?: string
    'aria-label'?: string
}

function Slider({
    value,
    onValueChange,
    onValueCommit,
    min = 0,
    max = 100,
    step = 1,
    disabled,
    className,
    ...props
}: SliderProps) {
    return (
        <SliderPrimitive.Root
            data-slot="slider"
            className={cn('relative flex h-[18px] w-full touch-none items-center select-none', className)}
            value={[value]}
            onValueChange={([next]) => next !== undefined && onValueChange(next)}
            onValueCommit={onValueCommit ? ([next]) => next !== undefined && onValueCommit(next) : undefined}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-label={props['aria-label']}
        >
            <SliderPrimitive.Track className="relative h-[6px] w-full grow rounded-[3px] bg-hairline">
                <SliderPrimitive.Range className="absolute h-full rounded-[3px] bg-brand" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="block size-[18px] rounded-full border-2 border-brand bg-surface outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50" />
        </SliderPrimitive.Root>
    )
}

export { Slider }
