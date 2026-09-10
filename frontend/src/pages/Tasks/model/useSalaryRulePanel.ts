import { useState } from 'react'
import type { SalesDirection } from 'ireports-contracts'

export type SalaryRuleRef = { ruleId: string; direction: SalesDirection }

/**
 * add-task-salary-rule-links-comments, tasks.md группа 30 (architecture.md: `useSalaryRulePanel()`
 * — "state-хук, без побочных эффектов" -> `{openRuleRef, openRule, closeRule}`). По образцу
 * `features/SalaryRuleForm/model/useTaskLinkPanels.ts`'s `openTaskId`/`openTask`/`closeTaskDetails`
 * — только состояние "какая панель открыта для какого правила", без единого обращения к сети;
 * данные самого правила загружает `useSalaryRule` внутри `features/SalaryRuleDetailsPanel`.
 *
 * `openRuleRef` — не просто `SalaryRuleRef | null`, а уже готовый объект пропсов
 * `{ruleId, direction, open}`, рассчитанный на спред прямо в `SalaryRuleDetailsPanel`
 * (`<SalaryRuleDetailsPanel {...openRuleRef} onClose={closeRule} />`, см. `mediator/
 * TasksPageMediator.tsx`) — `ruleId`/`direction` разведены с `open` тем же способом, каким
 * `SalaryRuleDetailsPanelProps` уже разводит их (её JSDoc): `closeRule()` гасит только `open`,
 * оставляя `ruleId`/`direction` последнего открытого правила — иначе `SidePanel`'s slide-out
 * анимация показывала бы пустое содержимое, пока панель уезжает за экран.
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
