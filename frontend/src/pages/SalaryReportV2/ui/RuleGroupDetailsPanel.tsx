import { useState } from 'react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { SidePanel } from '@/shared/ui-kit/organisms/SidePanel.tsx'

import { sumAllFactPrognose, type SalaryDirection, type SalaryReportRule } from '@/features/SalaryReportData'

import { LEDGER_CHEVRON_COL, LEDGER_VALUE_COL } from '../model/ledgerColumns.ts'

import { LedgerHero } from './LedgerHero.tsx'
import { LedgerRuleRow } from './LedgerRuleRow.tsx'

export type RuleGroupDetailsPanelProps = {
    /** Заголовок панели — `getRoleLabel(role)` для группы роли (`YCxrT`'s строка роли) или название
     * задачного правила/"Задачи" для карточки «Источник · Задачи» (`hGHjj`/`M39uQ`) — вызывающая
     * сторона решает, что показать, панель просто рендерит его в шапке `SidePanel`. */
    title: string
    /** Правила, которые панель детализирует — группа роли (`RuleRoleGroup.rules` из
     * `groupRulesByRole`) или одно задачное правило (`[rule]`, см. `splitRulesByType`). Ровно один
     * элемент — ожидаемый и нормальный случай (задача), не повод скрывать группировку по правилам. */
    rules: SalaryReportRule[]
    direction: SalaryDirection
    open: boolean
    onClose: () => void
}

/**
 * Панель детализации роли/задачи (Pencil: `design/sallary-first-iteration.pen`, узлы
 * «Вариант C · Детализация задачи» `hGHjj`/`M39uQ` и «Вариант C · Детализация правила»
 * `HNAzP`/`rdmcp` — один и тот же компонент с разными данными: у задачи `rules.length === 1`
 * (единственное `TaskCompletion`-правило), у роли — вся группа `groupRulesByRole` целиком). Тот же
 * `SidePanel`, что и `features/SalaryRuleDetailsPanel`/`features/TaskStatusControl`'s
 * `TaskDetailsPanel` — НЕ новый drawer с нуля.
 *
 * Показывает РОВНО те поля, что есть в контракте отчёта (`SalaryReportRule`) — никаких
 * "Статус"/"Срок"/"Ответственный"/"История начислений" из мокапа: контракт их не несёт (см.
 * `employeeSalaryReportRuleSchema`), а макет — только визуальная основа, не источник полей.
 *
 * Тело группирует начисления ПО ПРАВИЛАМ (а не одним плоским списком заказов на всю роль,
 * это была явная ошибка исходного макета) — `rules.map` рендерит каждое правило через
 * переиспользованный `LedgerRuleRow` (тот сам разворачивает `RuleSourcesRail` по клику на строку).
 * Локальный `Set` развёрнутых `ruleId` живёт внутри этого компонента — презентационный UI-стейт
 * самой панели, а не общий `isRuleExpanded`/`onToggleRule` страницы (`useSalaryReportSelection`):
 * при открытии панели ни одно правило не должно быть уже развёрнуто только потому, что его строка
 * случайно была развёрнута где-то в карточке-гроссбухе отчёта отдела/сотрудника — состояния разных
 * мест эксплицитно не связаны.
 */
export function RuleGroupDetailsPanel({ title, rules, direction, open, onClose }: RuleGroupDetailsPanelProps) {
    const [expandedRuleIds, setExpandedRuleIds] = useState<ReadonlySet<string>>(() => new Set())

    function toggleRule(ruleId: string) {
        setExpandedRuleIds((prev) => {
            const next = new Set(prev)
            if (next.has(ruleId)) next.delete(ruleId)
            else next.add(ruleId)
            return next
        })
    }

    const total = sumAllFactPrognose(rules.map((rule) => rule.amount))

    return (
        <SidePanel
            open={open}
            onOpenChange={(nextOpen) => !nextOpen && onClose()}
            title={title}
            footer={
                <div className="flex items-center justify-between gap-3">
                    <span className="font-ui text-xs font-semibold text-ink-muted">Итого по «{title}»</span>
                    <span className="font-ui text-sm font-bold text-ink tabular-nums">
                        {formatCurrency(total.fact)}
                    </span>
                </div>
            }
        >
            <LedgerHero grandTotal={total} isClosed={total.prognose === null} className="border-b border-hairline" />

            {rules.length === 0 ? (
                <p className="px-5 py-4 text-center font-ui text-xs text-ink-muted">Нет начислений.</p>
            ) : (
                <>
                    <div className="flex items-center gap-2 bg-canvas px-5 py-2.5 md:gap-3">
                        <span className="min-w-0 flex-1 font-ui text-xs font-semibold text-ink">
                            Правило начисления
                        </span>
                        <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-semibold text-ink')}>
                            Факт, ₽
                        </span>
                        <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-medium text-ink-muted')}>
                            Прогноз, ₽
                        </span>
                        <span className={LEDGER_CHEVRON_COL} />
                    </div>

                    <div className="bg-canvas">
                        {rules.map((rule) => (
                            <LedgerRuleRow
                                key={rule.ruleId}
                                rule={rule}
                                direction={direction}
                                isExpanded={expandedRuleIds.has(rule.ruleId)}
                                onToggle={() => toggleRule(rule.ruleId)}
                            />
                        ))}
                    </div>
                </>
            )}
        </SidePanel>
    )
}
