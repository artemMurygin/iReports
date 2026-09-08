import { useState } from 'react'

import { useCreateTask } from './useCreateTask.ts'

type CreateTaskDraft = {
    title: string
    description: string
    /** `YYYY-MM-DD` — значение `<input type="date">`, отправляется как есть (ISO-строка, парсится
     * `Date.parse` и на бэкенде `new Date(...)`, см. `create-task.http.controller.ts`). */
    deadline: string
    assigneeEmployeeId: number | null
}

const EMPTY_DRAFT: CreateTaskDraft = { title: '', description: '', deadline: '', assigneeEmployeeId: null }

/**
 * replace-bitrix-task-integration, раздел 11 tasks.md — плоский объект состояния формы создания
 * задачи (frontend/CLAUDE.md, "model-хуки с плоским объектом состояния"): держит черновик полей,
 * простую required-валидацию (`canSubmit`) и композирует `useCreateTask` — на успехе сбрасывает
 * черновик и уведомляет вызывающего через `onCreated(taskId)`, чтобы и общая страница `/tasks`
 * (закрыть модалку/обновить список), и Шаг 1 мастера создания правила `TaskCompletion`
 * (перейти к Шагу 2, уже зная `taskId`) могли отреагировать без знания о внутреннем стейте формы.
 */
export function useCreateTaskForm(onCreated?: (taskId: string) => void) {
    const [draft, setDraft] = useState<CreateTaskDraft>(EMPTY_DRAFT)
    const createTask = useCreateTask()

    function patch(partial: Partial<CreateTaskDraft>) {
        setDraft((prev) => ({ ...prev, ...partial }))
    }

    const canSubmit = draft.title.trim() !== '' && draft.deadline !== '' && draft.assigneeEmployeeId !== null

    function submit() {
        if (!canSubmit || draft.assigneeEmployeeId === null) return

        createTask.mutate(
            {
                title: draft.title.trim(),
                description: draft.description.trim() === '' ? undefined : draft.description.trim(),
                deadline: draft.deadline,
                assigneeEmployeeId: draft.assigneeEmployeeId,
            },
            {
                onSuccess: (response) => {
                    setDraft(EMPTY_DRAFT)
                    onCreated?.(response.id)
                },
            },
        )
    }

    return {
        draft,
        patch,
        canSubmit,
        submit,
        isPending: createTask.isPending,
        error: createTask.error,
    }
}
