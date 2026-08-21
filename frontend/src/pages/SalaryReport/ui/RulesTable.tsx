import { ChevronDown } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import { formatFloatPercentRange } from '../model/formatFloatPercentRange.ts'
import { isFloatPercentRule, type SalaryDirection, type SalaryReportRule } from '../model/types.ts'

import { RuleSources } from './RuleSources.tsx'
import { RuleTypeIcon } from './RuleTypeIcon.tsx'

export type RulesTableProps = {
    rules: SalaryReportRule[]
    direction: SalaryDirection
    isClosed: boolean
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void
    className?: string
}

const COLUMNS = 'grid-cols-[36px_minmax(0,1fr)_130px_140px_140px]'

/**
 * Pencil: `t3QCM`'s "Rules Table · Сервис/Магазин" (`bivGH`) — десктопная таблица правил
 * направления: экспандер · Правило (иконка типа + название + мета) · %, факт → прогноз (только
 * KPI-правила, `formatFloatPercentRange`) · Факт, ₽ · Прогноз, ₽. Разворот строки (фон
 * `bg-row-selected`, как в мокапе) показывает `RuleSources` — заказы, на которых получена сумма
 * правила.
 *
 * Ключ строки — `${direction}:${rule.ruleId}` (см. `EmployeeReportBodyProps.isRuleExpanded`'s
 * комментарий): один и тот же `ruleId` теоретически может повторяться между направлениями
 * (сервис/магазин — разные зарплатные схемы), поэтому направление — часть ключа разворота.
 */
export function RulesTable({ rules, direction, isClosed, isRuleExpanded, onToggleRule, className }: RulesTableProps) {
    if (rules.length === 0) {
        return (
            <div className={cn('rounded-xl border border-hairline bg-surface p-4 text-center', className)}>
                <p className="font-ui text-xs text-ink-muted">В этом направлении нет зарплатных правил.</p>
            </div>
        )
    }

    return (
        <div data-slot="rules-table" className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}>
            <div className={cn('grid items-center gap-2 border-b border-hairline bg-canvas px-3 py-2.5', COLUMNS)}>
                <span />
                <span className="font-ui text-xs font-semibold text-ink">Правило</span>
                <span className="text-right font-ui text-xs font-medium text-ink-muted">%, факт → прогноз</span>
                <span className="text-right font-ui text-xs font-semibold text-ink">Факт, ₽</span>
                <span className="text-right font-ui text-xs font-medium text-ink-muted">Прогноз, ₽</span>
            </div>

            {rules.map((rule, index) => {
                const key = `${direction}:${rule.ruleId}`
                const expanded = isRuleExpanded(key)
                const percentLabel = formatFloatPercentRange(rule, isClosed)
                const metaLabel = isFloatPercentRule(rule) ? 'Плавающий процент (KPI)' : 'Фиксированная ставка'

                return (
                    <div
                        key={rule.ruleId}
                        className={cn(index > 0 && 'border-t border-hairline', expanded && 'bg-row-selected')}
                    >
                        <button
                            type="button"
                            onClick={() => onToggleRule(key)}
                            aria-expanded={expanded}
                            className={cn('grid w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-canvas', COLUMNS)}
                        >
                            <ChevronDown
                                className={cn(
                                    'size-4 shrink-0 text-ink-muted transition-transform duration-150',
                                    expanded && 'rotate-180',
                                )}
                            />
                            <span className="flex min-w-0 items-center gap-2.5">
                                <RuleTypeIcon rule={rule} />
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate font-ui text-[13px] font-semibold text-ink">{rule.name}</span>
                                    <span className="truncate font-ui text-[11px] text-ink-muted">{metaLabel}</span>
                                </span>
                            </span>
                            <span className="text-right font-ui text-[12.5px] font-semibold text-ink tabular-nums">
                                {percentLabel}
                            </span>
                            <span className="text-right font-ui text-sm font-bold text-ink tabular-nums">
                                {formatCurrency(rule.amount.fact)}
                            </span>
                            <span className="text-right font-ui text-sm font-bold text-ink-muted tabular-nums">
                                {rule.amount.prognose === null ? '—' : formatCurrency(rule.amount.prognose)}
                            </span>
                        </button>

                        {expanded && <RuleSources sources={rule.sources} className="border-t border-hairline bg-canvas" />}
                    </div>
                )
            })}
        </div>
    )
}
