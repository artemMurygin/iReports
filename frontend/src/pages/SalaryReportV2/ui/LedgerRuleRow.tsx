import { ChevronDown } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import { isFloatPercentRule, type SalaryDirection, type SalaryReportRule } from '@/features/SalaryReportData'

import { LEDGER_CHEVRON_COL, LEDGER_VALUE_COL } from '../model/ledgerColumns.ts'
import { getRuleRate } from '../model/ruleRate.ts'

import { RuleSourcesRail } from './RuleSourcesRail.tsx'

export type LedgerRuleRowProps = {
    rule: SalaryReportRule
    direction: SalaryDirection
    isClosed: boolean
    isExpanded: boolean
    onToggle: () => void
    className?: string
}

/** Точка-индикатор красится по НАПРАВЛЕНИЮ (зелёный `brand-strong` у "Сервис", фиолетовый
 * `violet-ink` у "Магазин"), а не по типу правила — см. `H7Mz74`'s сэмплы: `HN52y`/`Zfa5m`/`Wkwe6`
 * (все три правила блока "Сервис", вперемешку KPI/фикс-ставка) все зелёные, `gYcab`/`Yv0Hv`/`Ongtq`
 * (блок "Магазин") все фиолетовые. */
const DOT_CLASS: Record<SalaryDirection, string> = {
    service: 'bg-brand-strong',
    shop: 'bg-violet-ink',
}

/**
 * Одна строка правила в карточке-гроссбухе (Pencil: `H7Mz74`'s `cyS5Q`/`Ko5rz`/`d3FgSn` —
 * десктоп 140px колонки, `b63e8p`'s `rNHXS`/`AkdPv` — мобайл 80px, см. `LEDGER_VALUE_COL`):
 * точка направления + название + мета ("Плавающий процент · KPI"/"Фиксированная ставка", как в
 * старом `RulesTable`) слева, Факт/Прогноз с подписью ставки (`getRuleRate`) справа. Разворот
 * (`isExpanded`/`onToggle`, ключ — тот же `${direction}:${rule.ruleId}`, собирается вызывающей
 * стороной) показывает `RuleSourcesRail`.
 *
 * Шеврон — добавление сверх макета: статичный мокап рисует ровно один пример уже развёрнутой
 * строки без видимого аффорданса разворота, но контракт компонента требует рабочего
 * `isRuleExpanded`/`onToggleRule`, так что без явного триггера кликабельность строки была бы не
 * очевидна пользователю.
 */
export function LedgerRuleRow({ rule, direction, isClosed, isExpanded, onToggle, className }: LedgerRuleRowProps) {
    const rate = getRuleRate(rule, isClosed)
    const metaLabel = isFloatPercentRule(rule) ? 'Плавающий процент · KPI' : 'Фиксированная ставка'

    return (
        <div data-slot="ledger-rule-row" className={cn(expanded(isExpanded), className)}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-canvas md:gap-3 md:px-5"
            >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                        <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[direction])} aria-hidden />
                        <span className="truncate font-ui text-[13px] font-semibold text-ink">{rule.name}</span>
                    </span>
                    <span className="truncate font-ui text-[11px] text-ink-muted">{metaLabel}</span>
                </span>

                <span className={cn(LEDGER_VALUE_COL, 'flex flex-col gap-0.5')}>
                    <span className="font-ui text-sm font-bold text-ink tabular-nums">{formatCurrency(rule.amount.fact)}</span>
                </span>

                <span className={cn(LEDGER_VALUE_COL, 'flex flex-col gap-0.5')}>
                    <span className="font-ui text-sm font-bold text-ink-muted tabular-nums">
                        {rule.amount.prognose === null ? '—' : formatCurrency(rule.amount.prognose)}
                    </span>
                </span>

                <span className={LEDGER_CHEVRON_COL}>
                    <ChevronDown
                        className={cn('size-4 shrink-0 text-ink-muted transition-transform duration-150', isExpanded && 'rotate-180')}
                    />
                </span>
            </button>

            {isExpanded && <RuleSourcesRail sources={rule.sources} className="border-t border-hairline bg-canvas" />}
        </div>
    )
}

function expanded(isExpanded: boolean) {
    return cn('border-t border-hairline first:border-t-0', isExpanded && 'bg-row-selected')
}
