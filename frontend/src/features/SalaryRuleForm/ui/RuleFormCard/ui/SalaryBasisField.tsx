import { SegmentedControl } from '@/shared/ui-kit/atoms/SegmentedControl'

import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { SalaryBasisValue } from '../../../model/ruleDraft.ts'

export type SalaryBasisFieldProps = {
    options: RuleFormConfig['salaryBasisOptions']
    value: SalaryBasisValue
    onValueChange: (value: SalaryBasisValue) => void
}

/**
 * "База начисления" field — Pencil node `Qw1Bv`/`I3Am6j`: the horizontal 2–3 option
 * `SegmentedControl` on `md:` and up, but a `vertical`-oriented one (one full-width row per
 * option) below it. Needed because the horizontal layout's `flex-1` tabs can't fit
 * `SALARY_MINUS_ENGINEER_SALARY`'s label ("Маржа - начисление инженера") at phone width without
 * overflowing the card — see `SegmentedControl`'s own comment on the `orientation` prop. Both
 * `SegmentedControl`s are mounted (one hidden per breakpoint, same `value`/`onValueChange`), the
 * same pattern used throughout Фаза 5 rather than a JS width check.
 */
export function SalaryBasisField({ options, value, onValueChange }: SalaryBasisFieldProps) {
    return (
        <div className="flex flex-1 flex-col gap-1.5">
            <span className="font-ui text-xs font-medium text-ink-muted">База начисления</span>
            <SegmentedControl
                aria-label="База начисления"
                options={options}
                value={value}
                onValueChange={onValueChange}
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
