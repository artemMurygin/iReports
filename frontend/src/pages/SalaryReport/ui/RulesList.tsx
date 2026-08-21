import { ChevronDown } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import { formatFloatPercentRange } from '../model/formatFloatPercentRange.ts'
import type { SalaryDirection, SalaryReportRule } from '../model/types.ts'

import { RuleSources } from './RuleSources.tsx'
import { RuleTypeIcon } from './RuleTypeIcon.tsx'

export type RulesListProps = {
    rules: SalaryReportRule[]
    direction: SalaryDirection
    isClosed: boolean
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void
    className?: string
}

/**
 * Pencil: `Z0lgF`'s "Rules" (`Fym1H`) — мобильный аналог `RulesTable`: карточка-строка (название +
 * процент под ним, если KPI-правило) слева, факт крупно / прогноз приглушённо справа, шеврон.
 * Меты типа/роли здесь нет — мокап её на мобильном не показывает (в отличие от десктопа), только
 * название + опциональный процент, тот же приём уже применён в `EmployeesList` (отдел).
 */
export function RulesList({ rules, direction, isClosed, isRuleExpanded, onToggleRule, className }: RulesListProps) {
    if (rules.length === 0) {
        return (
            <div className={cn('rounded-xl border border-hairline bg-surface p-4 text-center', className)}>
                <p className="font-ui text-xs text-ink-muted">В этом направлении нет зарплатных правил.</p>
            </div>
        )
    }

    return (
        <div data-slot="rules-list" className={cn('flex flex-col gap-2', className)}>
            {rules.map((rule) => {
                const key = `${direction}:${rule.ruleId}`
                const expanded = isRuleExpanded(key)
                const percentLabel = formatFloatPercentRange(rule, isClosed)

                return (
                    <div
                        key={rule.ruleId}
                        className={cn(
                            'overflow-hidden rounded-xl border border-hairline',
                            expanded ? 'bg-row-selected' : 'bg-surface',
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => onToggleRule(key)}
                            aria-expanded={expanded}
                            className="flex w-full items-center justify-between gap-3 p-3 text-left"
                        >
                            <span className="flex min-w-0 items-center gap-2.5">
                                <RuleTypeIcon rule={rule} />
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="truncate font-ui text-[13px] font-semibold text-ink">{rule.name}</span>
                                    {percentLabel && (
                                        <span className="truncate font-ui text-[11.5px] font-semibold text-ink-muted">
                                            {percentLabel}
                                        </span>
                                    )}
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                                <span className="flex flex-col items-end gap-0.5">
                                    <span className="font-ui text-sm font-bold text-ink tabular-nums">
                                        {formatCurrency(rule.amount.fact)}
                                    </span>
                                    <span className="font-ui text-[11.5px] text-ink-muted tabular-nums">
                                        {rule.amount.prognose === null ? '—' : formatCurrency(rule.amount.prognose)}
                                    </span>
                                </span>
                                <ChevronDown
                                    className={cn(
                                        'size-4 shrink-0 text-ink-muted transition-transform duration-150',
                                        expanded && 'rotate-180',
                                    )}
                                />
                            </span>
                        </button>

                        {expanded && <RuleSources sources={rule.sources} className="border-t border-hairline bg-canvas" />}
                    </div>
                )
            })}
        </div>
    )
}
