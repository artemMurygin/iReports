import type { SalesDirection } from 'ireports-contracts'

import { SidePanel } from '@/shared/ui-kit/organisms/SidePanel.tsx'
import { Button } from '@/shared/ui-kit/atoms/Button.tsx'

import { useSalaryRule } from '../model/useSalaryRule.ts'
import { useSalaryRuleActivation } from '../model/useSalaryRuleActivation.ts'
import { SalaryRuleSummaryCard } from './SalaryRuleSummaryCard.tsx'

/**
 * Pencil: `XiJo6` (десктоп 1440, панель 460px), `Nuezn` (мобильный 390, bottom sheet) —
 * add-task-salary-rule-links-comments, tasks.md группа 29. Публичный компонент фичи
 * (architecture.md: `SalaryRuleDetailsPanel({ ruleId, direction, open, onClose })`),
 * реэкспортируется `index.ts`. Тот же `SidePanel`, что и `TaskDetailsPanel`
 * (`features/TaskStatusControl`) — read-only, без кнопок редактирования, футер только с «Закрыть»
 * (design.md Non-Goals: редактирование остаётся на странице зарплатного правила). Единственное
 * исключение — soft-деактивация/восстановление ОДНОГО правила (`rule.isActive`, кнопка «Деактивировать»/
 * «Активировать» в теле `SalaryRuleSummaryCard`, мутация — `useSalaryRuleActivation`): это единственное
 * место в приложении, где неактивное правило вообще видно (обычный список правил схемы его скрывает),
 * поэтому переключатель живёт здесь же, а не только на странице схемы.
 *
 * `ruleId`/`open` разведены (а не один `ruleId !== null`, как у `TaskDetailsPanel`) — так вызывающий
 * `useSalaryRulePanel()` (tasks.md группа 30) может закрыть панель, не немедленно теряя `ruleId`
 * (`SidePanel`'s slide-out анимация продолжает показывать последнее правило, пока панель
 * закрывается), тот же приём, что `TaskDetailsPanel`/`taskId` уже использует по факту передачи
 * `null` только после анимации — здесь это явное намерение, а не побочный эффект.
 *
 * Содержимое (`SalaryRuleDetailsPanelContent`) монтируется только пока `ruleId` не `null` —
 * `useSalaryRule` не поддерживает `enabled`/условный вызов (tasks.md группа 28, хук уже
 * реализован и покрыт тестами), поэтому запрос гасится размонтированием, а не условием внутри
 * хука, тем же способом, каким `TaskDetailsPanel` гасит `useTask` через размонтирование
 * `TaskStatusControl`.
 */
export type SalaryRuleDetailsPanelProps = {
    ruleId: string | null
    direction: SalesDirection
    open: boolean
    onClose: () => void
}

export function SalaryRuleDetailsPanel({ ruleId, direction, open, onClose }: SalaryRuleDetailsPanelProps) {
    return (
        <SidePanel
            open={open}
            onOpenChange={(nextOpen) => !nextOpen && onClose()}
            srOnlyTitle="Зарплатное правило"
            footer={
                <Button variant="secondary" className="w-full" onClick={onClose}>
                    Закрыть
                </Button>
            }
        >
            {ruleId && <SalaryRuleDetailsPanelContent ruleId={ruleId} direction={direction} onClose={onClose} />}
        </SidePanel>
    )
}

type SalaryRuleDetailsPanelContentProps = {
    ruleId: string
    direction: SalesDirection
    onClose: () => void
}

function SalaryRuleDetailsPanelContent({ ruleId, direction, onClose }: SalaryRuleDetailsPanelContentProps) {
    const { rule, isLoading, error } = useSalaryRule(ruleId, direction)
    const { deactivate, activate, isPending } = useSalaryRuleActivation(ruleId, direction)

    if (isLoading) {
        return (
            <div data-slot="salary-rule-details-panel-loading" className="p-5 font-ui text-sm text-ink-muted">
                Загрузка правила…
            </div>
        )
    }

    if (error || !rule) {
        return (
            <div data-slot="salary-rule-details-panel-error" className="p-5 font-ui text-sm text-danger">
                {error instanceof Error ? error.message : 'Не удалось загрузить зарплатное правило'}
            </div>
        )
    }

    return (
        <SalaryRuleSummaryCard
            rule={rule}
            onClose={onClose}
            onToggleActive={rule.isActive ? deactivate : activate}
            isTogglingActive={isPending}
        />
    )
}
