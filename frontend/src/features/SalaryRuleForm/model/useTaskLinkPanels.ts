import { useState } from 'react'

import type { RuleDraft } from './ruleDraft.ts'

/**
 * Оркестрация двух боковых панелей вокруг `TaskCompletion.config`'s привязанной задачи —
 * "Создать задачу" (`draft.taskId === ''`, открывает `features/CreateTask`'s `CreateTaskPanel`) и
 * "Карточка задачи" (`draft.taskId` уже есть, открывает `features/TaskStatusControl`'s
 * `TaskDetailsPanel`) — не сама фича, а только состояние "какая панель открыта для какого
 * черновика" и проводка "задача создана -> запиши taskId в черновик -> закрой панель".
 *
 * Живёт в `features/SalaryRuleForm` (а не дублируется по страницам, как раньше был устроен мастер
 * `CreateTaskCompletionRuleWizard`), потому что сам НЕ импортирует ни `features/CreateTask`, ни
 * `features/TaskStatusControl` — только их таргет-нейтральный `taskId`/`draftId`. Рендер самих
 * панелей (`<CreateTaskPanel .../>`/`<TaskDetailsPanel .../>`) при этом остаётся на странице
 * (`pages/SalaryRuleDetail`/`pages/SalaryRules`) — `SalaryRuleForm` не может импортировать те две
 * фичи напрямую (frontend/CLAUDE.md, кросс-фичевый импорт запрещён), странице это разрешено.
 */
export function useTaskLinkPanels(onChange: (draftId: string, patch: Partial<RuleDraft>) => void) {
    const [openTaskId, setOpenTaskId] = useState<string | null>(null)
    const [creatingForDraftId, setCreatingForDraftId] = useState<string | null>(null)

    function handleTaskCreated(taskId: string) {
        if (creatingForDraftId) {
            onChange(creatingForDraftId, { taskId })
        }
        setCreatingForDraftId(null)
    }

    return {
        openTaskId,
        openTask: setOpenTaskId,
        closeTaskDetails: () => setOpenTaskId(null),
        isCreatingTask: creatingForDraftId !== null,
        requestCreateTask: setCreatingForDraftId,
        cancelCreateTask: () => setCreatingForDraftId(null),
        handleTaskCreated,
    }
}
