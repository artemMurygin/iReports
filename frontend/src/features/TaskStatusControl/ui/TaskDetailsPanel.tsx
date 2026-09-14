import type { TaskDirection } from 'ireports-contracts'

import { SidePanel } from '@/shared/ui-kit/organisms/SidePanel.tsx'

import { TaskCommentComposerContainer } from './TaskCommentComposerContainer.tsx'
import { TaskStatusControl } from './TaskStatusControl.tsx'

export type TaskDetailsPanelProps = {
    taskId: string | null
    onClose: () => void
    /**
     * add-task-salary-rule-links-comments, tasks.md 27.1: опциональный проп, прокидывается насквозь
     * в `TaskStatusControl` -> `TaskStatusCard` -> `SalaryRuleSummaryBlock`. Без него блок связанного
     * правила отображается некликабельным (`pages/SalaryRuleDetail`/`pages/SalaryRules` не прокидывают
     * его — architecture.md, "Pages": "onOpenSalaryRule туда не прокидывается").
     */
    onOpenSalaryRule?: (args: { ruleId: string; direction: TaskDirection }) => void
}

/**
 * Публичный компонент фичи — `SidePanel` (`shared/ui-kit`) chrome around `TaskStatusControl`.
 * `TaskStatusCard` already renders its own visible title + close button (`X`) inside the panel, so
 * this only supplies a visually-hidden `Dialog.Title` for the accessible name Radix requires, not a
 * second visible header (same reasoning `pages/Tasks/ui/TaskDrawer.tsx` used to have inline before
 * this was promoted into the feature so `pages/SalaryRuleDetail`/`pages/SalaryRules` — which can't
 * import a `pages/Tasks` component, frontend/CLAUDE.md — could reuse it too, see
 * `features/SalaryRuleForm`'s task-linking flow).
 *
 * `md:w-[552px]` — та же ширина, что у соседних боковых панелей отчёта сотрудника
 * (`pages/SalaryReportV2`'s `RuleGroupDetailsPanel`/`SalesPlanDetailsPanel`), а не дефолтный
 * `SidePanel`'s 460px: один и тот же набор боковых панелей должен выглядеть однородно независимо
 * от того, какая из них открыта. `TaskStatusCard`'s собственный `md:w-[552px]` держит то же
 * значение — вторая линия защиты, чтобы карточка не сжималась внутри более широкой панели.
 *
 * Поле комментария (`TaskCommentComposerContainer` -> `TaskCommentComposer`) передаётся в
 * `SidePanel`'s `footer`, а не рендерится внутри `TaskStatusControl`/`TaskStatusCard`: `footer` —
 * настоящий `shrink-0`-сосед прокручиваемого содержимого панели (см. `SidePanel.tsx`), который
 * всегда остаётся у нижнего края независимо от объёма контента — то, что не может дать
 * `position: sticky` внутри самого прокручиваемого содержимого (см. `TaskCommentComposer`'s JSDoc).
 */
export function TaskDetailsPanel({ taskId, onClose, onOpenSalaryRule }: TaskDetailsPanelProps) {
    return (
        <SidePanel
            open={taskId !== null}
            onOpenChange={(open) => !open && onClose()}
            srOnlyTitle="Карточка задачи"
            className="md:w-[552px]"
            footer={taskId ? <TaskCommentComposerContainer taskId={taskId} /> : undefined}
        >
            {taskId && <TaskStatusControl taskId={taskId} onClose={onClose} onOpenSalaryRule={onOpenSalaryRule} />}
        </SidePanel>
    )
}
