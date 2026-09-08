import { useState } from 'react'

export type WizardStep = 'task' | 'rule'

/**
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.1/14.3) — оркестрация 2-шагового
 * мастера создания правила `TaskCompletion` (`pages/SalaryRuleDetail/mediator`, architecture.md's
 * `useCreateTaskCompletionRuleWizard`): держит ТОЛЬКО номер шага и id только что созданной на
 * Шаге 1 задачи — сам не создаёт ни задачу, ни правило, только композирует переход между двумя уже
 * готовыми виджетами:
 * - Шаг 1 (создание задачи) — `features/CreateTask`'s `CreateTaskForm` (раздел 11 tasks.md), уже
 *   инкапсулирующая `useCreateTask` внутри себя; этот хук лишь принимает готовый `taskId` через
 *   `goToRuleStep` — колбэк `CreateTaskForm`'s `onCreated`.
 * - Шаг 2 (форма правила) — уже существующий стейт редактирования схемы (`useSalaryRulesDraft`,
 *   раздел 4 фазы "salary-schema-creation-ui"), прокинутый компонентом-мандатором
 *   (`CreateTaskCompletionRuleWizard.tsx`) как пропсы; сам хук о нём ничего не знает.
 *
 * `step` — производное значение (`createdTaskId ? 'rule' : 'task'`), не отдельный кусок стейта:
 * переход на Шаг 2 невозможен раньше, чем появится `createdTaskId`, и это гарантировано структурой
 * состояния, а не отдельной проверкой при переходе.
 */
export function useCreateTaskCompletionRuleWizard() {
    const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)

    const step: WizardStep = createdTaskId ? 'rule' : 'task'

    function goToRuleStep(taskId: string) {
        setCreatedTaskId(taskId)
    }

    function reset() {
        setCreatedTaskId(null)
    }

    return { step, createdTaskId, goToRuleStep, reset }
}
