import { Slider } from '@/shared/ui-kit/atoms/Slider'

export type PercentSliderFieldProps = {
    label: string
    value: string
    onValueChange: (value: string) => void
    min?: number
    max?: number
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `tBii8` (`Поле · Базовый процент (слайдер)`) —
 * label + value badge on top, the `Slider` atom, and a min/max scale row below it. Page-level (not
 * `shared/ui-kit`) composition of the label/badge/scale copy around the bare `Slider` atom, reused
 * for every percent field in the rule form (`FloatPercent.basePercent`, `FixedPercent.percent`,
 * `ServicePercent.percent`) with only the `label` text differing.
 *
 * `value`/`onValueChange` are strings (not numbers) to match every other numeric field in the rule
 * form's "text input, parse on submit" convention (see each direction's `ruleFormSchema.ts` and its
 * `parseNumber`) — internally converts to/from the `Slider` atom's numeric API, clamping/defaulting
 * an unparsable string to `min` so the slider always has a valid position even before the user picks
 * a value.
 */
export function PercentSliderField({
    label,
    value,
    onValueChange,
    min = 1,
    max = 100,
    className,
}: PercentSliderFieldProps) {
    const numeric = Number(value.replace(',', '.'))
    const sliderValue = Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : min

    return (
        <div className={className}>
            <div className="flex w-full flex-col gap-[9px]">
                <div className="flex w-full items-center justify-between gap-2.5">
                    <span className="font-ui text-xs font-medium text-ink-muted">{label}</span>
                    <span className="flex items-center gap-0.5 rounded-[6px] bg-brand-soft px-2 py-[3px]">
                        <span className="font-ui text-[13px] font-bold text-ink">
                            {value.trim() === '' ? min : value}
                        </span>
                        <span className="font-ui text-xs font-semibold text-ok-ink">%</span>
                    </span>
                </div>

                <Slider
                    aria-label={label}
                    value={sliderValue}
                    onValueChange={(next) => onValueChange(String(next))}
                    min={min}
                    max={max}
                />

                <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-ui text-[11px] text-ink-faint">{min} %</span>
                    <span className="font-ui text-[11px] text-ink-faint">{max} %</span>
                </div>
            </div>
        </div>
    )
}
