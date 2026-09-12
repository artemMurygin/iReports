import { useCallback, useEffect, useRef, useState } from 'react'

import { salaryRuleTaskApi } from './taskApi.ts'
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
 * фичи напрямую (frontend/CLAUDE.md, кросс-фичевый импорт запрещён).
 *
 * add-task-rule-task-lifecycle — задача, созданная через панель "Создать задачу", уже реальная
 * строка в БД (`POST /v1/tasks` отработал), а само правило `TaskCompletion` при этом ещё живёт
 * только в клиентском черновике до отдельного "Сохранить схему". Если пользователь так и не
 * сохранит схему (уходит со страницы, отменяет черновик и т.п.), эта задача осталась бы висеть в
 * системе безо всякой связи с чем-либо. `pendingTaskIds` — id всех задач, созданных ЗА ВРЕМЯ
 * ЖИЗНИ этого хука и ещё не подтверждённых как часть успешно сохранённой схемы; unmount-эффект
 * молча (`.catch(() => {})`) удаляет каждую такую задачу, когда форма размонтируется — использует
 * `pendingTaskIds.current` напрямую, а не переменную из замыкания, чтобы видеть добавления/очистку,
 * произошедшие после монтирования. Страница обязана вызвать `markTasksSaved()` из своего
 * onSuccess-колбэка сохранения схемы (`useServiceSchemaEditForm`/`useShopSchemaEditForm`/
 * `useSalaryRulesPage`) — иначе эффект удалит только что успешно сохранённые задачи следом за
 * навигацией со страницы.
 */
export function useTaskLinkPanels(onChange: (draftId: string, patch: Partial<RuleDraft>) => void) {
    const [openTaskId, setOpenTaskId] = useState<string | null>(null)
    const [creatingForDraftId, setCreatingForDraftId] = useState<string | null>(null)
    const pendingTaskIds = useRef<Set<string>>(new Set())

    function handleTaskCreated(taskId: string) {
        if (creatingForDraftId) {
            pendingTaskIds.current.add(taskId)
            onChange(creatingForDraftId, { taskId })
        }
        setCreatingForDraftId(null)
    }

    const markTasksSaved = useCallback(() => {
        pendingTaskIds.current.clear()
    }, [])

    useEffect(() => {
        const pending = pendingTaskIds.current
        return () => {
            pending.forEach((taskId) => {
                salaryRuleTaskApi.remove(taskId).catch(() => {})
            })
        }
    }, [])

    return {
        openTaskId,
        openTask: setOpenTaskId,
        closeTaskDetails: () => setOpenTaskId(null),
        isCreatingTask: creatingForDraftId !== null,
        requestCreateTask: setCreatingForDraftId,
        cancelCreateTask: () => setCreatingForDraftId(null),
        handleTaskCreated,
        markTasksSaved,
    }
}
