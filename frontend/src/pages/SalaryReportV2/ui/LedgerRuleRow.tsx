import { ChevronDown } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import type { SalaryDirection, SalaryReportRule } from '@/features/SalaryReportData'

import { LEDGER_CHEVRON_COL, LEDGER_VALUE_COL } from '../model/ledgerColumns.ts'

import { RuleSourcesRail } from './RuleSourcesRail.tsx'

export type LedgerRuleRowProps = {
    rule: SalaryReportRule
    direction: SalaryDirection
    isExpanded: boolean
    onToggle: () => void
    className?: string
}

/** Точка-индикатор красится по НАПРАВЛЕНИЮ (зелёный `brand-strong` у "Сервис", фиолетовый
 * `violet-ink` у "Магазин"), а не по типу правила — см. `H7Mz74`'s сэмплы: `HN52y`/`Zfa5m`/`Wkwe6`
 * (все три правила блока "Сервис", вперемешку KPI/фикс-ставка) все зелёные, `gYcab`/`Yv0Hv`/`Ongtq`
 * (блок "Магазин") все фиолетовые. Размер уменьшен вдвое против точки роли (`DirectionSourceCard`'s
 * `DOT_CLASS`, `size-2`) — часть общего облегчения этого уровня, см. JSDoc компонента ниже. */
const DOT_CLASS: Record<SalaryDirection, string> = {
    service: 'bg-brand-strong',
    shop: 'bg-violet-ink',
}

/**
 * Одна строка правила в карточке-гроссбухе (Pencil: `H7Mz74`'s `cyS5Q`/`Ko5rz`/`d3FgSn` —
 * десктоп 140px колонки, `b63e8p`'s `rNHXS`/`AkdPv` — мобайл 80px, см. `LEDGER_VALUE_COL`):
 * точка направления + название одной строкой слева (без подписи типа ставки — "Плавающий процент ·
 * KPI"/"Фиксированная ставка", как показывал старый `RulesTable`, — под ним, см. JSDoc ниже),
 * Факт/Прогноз справа. Разворот (`isExpanded`/`onToggle`, ключ — тот же `${direction}:${rule.ruleId}`,
 * собирается вызывающей стороной) показывает `RuleSourcesRail`.
 *
 * Единственный текущий потребитель — `RuleGroupDetailsPanel` (панель детализации роли/задачи,
 * тот же `bg-canvas`-фон "подложки", что и у `RuleSourcesRail` ниже), которая рендерит одну такую
 * строку на каждое правило группы — визуально ощутимо легче и КОМПАКТНЕЕ строки роли над ней (та же
 * лесенка уровней, что и `RuleSourcesRail`'s `pl-6`/`pl-10` относительно строки правила): без
 * подписи типа ставки под названием (одна строка вместо двух, вдвое ниже — раньше здесь показывались
 * "Плавающий процент · KPI"/"Фиксированная ставка"), меньший размер и вес шрифта названия/сумм
 * (`text-xs font-medium`/`text-[13px] font-semibold` против роли `text-[13px] font-semibold`/`text-
 * sm font-bold`), точка вдвое меньше, доп. левый отступ (`pl-5`/`md:pl-8` вместо `px-3`/`md:px-5` у
 * роли) и hover в `bg-surface` (не `bg-canvas`, которым уже залита сама подложка — иначе ховер не был
 * бы виден). Без этого набора отличий строки правил при развороте роли визуально не отличались от
 * самой строки роли и "сливались" с ней в один список.
 *
 * Шеврон — добавление сверх макета: статичный мокап рисует ровно один пример уже развёрнутой
 * строки без видимого аффорданса разворота, но контракт компонента требует рабочего
 * `isRuleExpanded`/`onToggleRule`, так что без явного триггера кликабельность строки была бы не
 * очевидна пользователю.
 */
export function LedgerRuleRow({ rule, direction, isExpanded, onToggle, className }: LedgerRuleRowProps) {
    return (
        <div data-slot="ledger-rule-row" className={cn(expanded(isExpanded), className)}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                className="flex w-full items-center gap-2 py-1.5 pr-3 pl-5 text-left transition-colors hover:bg-surface md:gap-3 md:pr-5 md:pl-8"
            >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className={cn('size-1 shrink-0 rounded-full', DOT_CLASS[direction])} aria-hidden />
                    <span className="truncate font-ui text-xs font-medium text-ink">{rule.name}</span>
                </span>

                <span className={cn(LEDGER_VALUE_COL, 'flex flex-col gap-0.5')}>
                    <span className="font-ui text-[13px] font-semibold text-ink tabular-nums">
                        {formatCurrency(rule.amount.fact)}
                    </span>
                </span>

                <span className={cn(LEDGER_VALUE_COL, 'flex flex-col gap-0.5')}>
                    <span className="font-ui text-[13px] font-semibold text-ink-muted tabular-nums">
                        {rule.amount.prognose === null ? '—' : formatCurrency(rule.amount.prognose)}
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
                    <RuleSourcesRail sources={rule.sources} />
                </div>
            )}
        </div>
    )
}

function expanded(isExpanded: boolean) {
    return cn('border-t border-hairline first:border-t-0', isExpanded && 'bg-row-selected')
}
