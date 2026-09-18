import { cn } from '@/shared/lib/tw'
import { SegmentedControl } from '@/shared/ui-kit/atoms/SegmentedControl'

import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { SalaryBasisValue } from '../../../model/ruleDraft.ts'

export type SalaryBasisFieldProps = {
    options: RuleFormConfig['salaryBasisOptions']
    value: SalaryBasisValue
    onValueChange: (value: SalaryBasisValue) => void
    className?: string
}

/**
 * "База начисления" field — Pencil node `Qw1Bv`/`I3Am6j`: the horizontal 2–3 option
 * `SegmentedControl` on `md:` and up, but a `vertical`-oriented one (one full-width row per
 * option) below it. Needed because the horizontal layout's `flex-1` tabs can't fit
 * `SALARY_MINUS_ENGINEER_SALARY`'s label ("Маржа - начисление инженера") at phone width without
 * overflowing the card — see `SegmentedControl`'s own comment on the `orientation` prop. Both
 * `SegmentedControl`s are mounted (one hidden per breakpoint, same `value`/`onValueChange`), the
 * same pattern used throughout Фаза 5 rather than a JS width check.
 *
 * Рендерится собственной строкой ниже сетки `Категория`/`Сумма`/переопределения отдела
 * (`RuleFormCardFields.tsx`), а не как ещё одна колонка той сетки — в узкой колонке 3 таба
 * `SegmentedControl` (особенно с `SALARY_MINUS_ENGINEER_SALARY`) слишком сжимались. `className`
 * ограничивает ширину получившейся полноразмерной строки (`max-w-sm` у вызывающих компонентов).
 */
export function SalaryBasisField({ options, value, onValueChange, className }: SalaryBasisFieldProps) {
    return (
        <div className={cn('flex flex-1 flex-col gap-1.5', className)}>
            <span className="font-ui text-xs font-medium text-ink-muted">База начисления</span>
            <SegmentedControl
                aria-label="База начисления"
                options={options}
                value={value}
                onValueChange={onValueChange}
                wrapLabels
                className="hidden md:flex"
            />
            <SegmentedControl
                aria-label="База начисления"
                options={options}
                value={value}
                onValueChange={onValueChange}
                orientation="vertical"
                className="flex md:hidden"
            />
        </div>
    )
}
