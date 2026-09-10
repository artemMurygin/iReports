import { ChevronDown } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { cn } from '@/shared/lib/tw'

import {
    getRoleLabel,
    sumAllFactPrognose,
    type SalaryDirection,
    type SalaryReportRule,
} from '@/features/SalaryReportData'

import type { TargetRole } from 'ireports-contracts'

import { LEDGER_CHEVRON_COL, LEDGER_VALUE_COL } from '../model/ledgerColumns.ts'

import { LedgerRuleRow } from './LedgerRuleRow.tsx'

export type LedgerRoleGroupProps = {
    role: TargetRole
    rules: SalaryReportRule[]
    direction: SalaryDirection
    isExpanded: boolean
    onToggle: () => void
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void
}

/** Тот же приём, что и у `LedgerRuleRow`'s `DOT_CLASS` — точка красится по направлению, не по роли. */
const DOT_CLASS: Record<SalaryDirection, string> = {
    service: 'bg-brand-strong',
    shop: 'bg-violet-ink',
}

/**
 * Группа правил одной роли (`rule.targetRole`) внутри блока направления (`LedgerDirectionBlock`,
 * см. `groupRulesByRole`) — визуально и по интеракции зеркалит строку правила (`LedgerRuleRow`):
 * точка направления + название роли (`getRoleLabel`) + "N правил" слева, сумма факта/прогноза ПО
 * ВСЕМ правилам роли (`sumAllFactPrognose`) справа, разворот по клику (`isExpanded`/`onToggle`)
 * показывает сами строки правил этой роли (`LedgerRuleRow`), каждая из которых по-прежнему
 * разворачивается отдельно и независимо (`isRuleExpanded`/`onToggleRule`, ключ —
 * `${direction}:${rule.ruleId}`, как и раньше).
 *
 * Разворот САМОЙ группы использует тот же общий `Set`-стейт ключей, что и строки правил
 * (`isRuleExpanded`/`onToggleRule` из `useSalaryReportSelection`), а не отдельный стейт — ключ
 * группы (`role:${direction}:${role}`, собирается вызывающей стороной) структурно не пересекается с
 * ключом правила (`${direction}:${rule.ruleId}`, всегда начинается с `service:`/`shop:`), поэтому
 * обоим уровням безопасно жить в одном `Set`.
 */
export function LedgerRoleGroup({
    role,
    rules,
    direction,
    isExpanded,
    onToggle,
    isRuleExpanded,
    onToggleRule,
}: LedgerRoleGroupProps) {
    const total = sumAllFactPrognose(rules.map((rule) => rule.amount))

    return (
        <div data-slot="ledger-role-group" className={expanded(isExpanded)}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-canvas md:gap-3 md:px-5"
            >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[direction])} aria-hidden />
                        <span className="truncate font-ui text-[13px] font-semibold text-ink">
                            {getRoleLabel(role)}
                        </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-ui text-[11px] text-ink-muted">
                            {pluralizeRules(rules.length)}
                        </span>
                    </span>
                </span>

                <span className={cn(LEDGER_VALUE_COL, 'flex flex-col gap-0.5')}>
                    <span className="font-ui text-sm font-bold text-ink tabular-nums">
                        {formatCurrency(total.fact)}
                    </span>
                </span>

                <span className={cn(LEDGER_VALUE_COL, 'flex flex-col gap-0.5')}>
                    <span className="font-ui text-sm font-bold text-ink-muted tabular-nums">
                        {total.prognose === null ? '—' : formatCurrency(total.prognose)}
                    </span>
                </span>

                <span className={LEDGER_CHEVRON_COL}>
                    <ChevronDown
                        className={cn(
                            'size-4 shrink-0 text-ink-muted transition-transform duration-150',
                            isExpanded && 'rotate-180',
                        )}
                    />
                </span>
            </button>

            {isExpanded && (
                <div className="border-t border-hairline bg-canvas">
                    {rules.map((rule) => {
                        const key = `${direction}:${rule.ruleId}`
                        return (
                            <LedgerRuleRow
                                key={rule.ruleId}
                                rule={rule}
                                direction={direction}
                                isExpanded={isRuleExpanded(key)}
                                onToggle={() => onToggleRule(key)}
                            />
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function expanded(isExpanded: boolean) {
    return cn('border-t border-hairline first:border-t-0', isExpanded && 'bg-row-selected')
}
