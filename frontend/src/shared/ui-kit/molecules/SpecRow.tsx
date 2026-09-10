import * as React from 'react'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `Q4IX0` (`ERP/Molecule/Spec Row`) —
 * add-task-salary-rule-links-comments, tasks.md группа 29 (ui-design.md «Новые компоненты UI
 * Kit»). Плотная строка «параметр — значение» с нижней линейкой, для read-only списков вроде
 * блока «Параметры правила» на `features/SalaryRuleDetailsPanel/ui/SalaryRuleSummaryCard.tsx` —
 * ближайший существующий `ERP/Molecule/Field` устроен как поле ввода (Label + Input), а не
 * read-only пара.
 *
 * `showDivider` — последняя строка списка в макете (`XiJo6`/`Nuezn`, node `hp4UD`/`xA9dk`)
 * скрывает нижнюю линейку (`strokeWidth: 0`), остальные её показывают — вызывающий код передаёт
 * `showDivider={false}` только для последнего элемента списка вместо того, чтобы компонент сам
 * угадывал свою позицию.
 *
 * `valueClassName` — узел `mzKBs` («Вознаграждение») переопределяет шрифт значения на
 * `$font-display`/700/13.5px вместо базового `$font-ui`/500/13px остальных строк списка; на
 * уровне компонента это per-instance переопределение класса, а не отдельный `tone`/`variant`.
 */
export type SpecRowProps = {
    label: string
    value: React.ReactNode
    showDivider?: boolean
    valueClassName?: string
    className?: string
}

function SpecRow({ label, value, showDivider = true, valueClassName, className }: SpecRowProps) {
    return (
        <div
            data-slot="spec-row"
            className={cn(
                'flex w-full items-center justify-between gap-3 py-[9px]',
                showDivider && 'border-b border-hairline',
                className,
            )}
        >
            <span className="font-ui text-[12.5px] text-ink-muted">{label}</span>
            <span className={cn('font-ui text-[13px] font-medium text-ink', valueClassName)}>{value}</span>
        </div>
    )
}

export { SpecRow }
