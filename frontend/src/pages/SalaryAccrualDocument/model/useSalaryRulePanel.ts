import { useState } from 'react'
import type { SalesDirection } from 'ireports-contracts'

export type SalaryRuleRef = { ruleId: string; direction: SalesDirection }

/**
 * Собственная копия `pages/Tasks/model/useSalaryRulePanel.ts` — кросс-страничный импорт запрещён
 * (frontend/CLAUDE.md, «pages не может импортировать другую страницу»), паттерн копируется, а не
 * переиспользуется. Тот же state-хук без побочных эффектов: `{openRuleRef, openRule, closeRule}` —
 * `useSalaryRule` внутри `features/SalaryRuleDetailsPanel` сама делает запрос по `ruleId`.
 *
 * Здесь панель открывается кликом по строке начисления в `AccrualLinesTable`/`AccrualLineCardList`
 * (`pages/SalaryAccrualDocument/mediator/SalaryAccrualDocumentPageMediator.tsx`), а не по связанному
 * правилу на карточке задачи — но состояние «какое правило открыто и для какого направления»
 * устроено идентично: `ruleId`/`direction` разведены с `open` тем же способом, каким уже разводит
 * их `SalaryRuleDetailsPanelProps` (см. её JSDoc) — `closeRule()` гасит только `open`, оставляя
 * `ruleId`/`direction` последнего открытого правила, чтобы slide-out анимация `SidePanel` не
 * показывала пустое содержимое, пока панель уезжает за экран.
 */
export function useSalaryRulePanel() {
    const [ref, setRef] = useState<SalaryRuleRef | null>(null)
    const [open, setOpen] = useState(false)

    function openRule(nextRef: SalaryRuleRef) {
        setRef(nextRef)
        setOpen(true)
    }

    function closeRule() {
        setOpen(false)
    }

    return {
        openRuleRef: {
            ruleId: ref?.ruleId ?? null,
            direction: ref?.direction ?? 'service',
            open,
        },
        openRule,
        closeRule,
    }
}

export type SalaryRulePanelState = ReturnType<typeof useSalaryRulePanel>
