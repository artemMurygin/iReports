import { useState } from 'react'
import type { Task } from 'ireports-contracts'

import { useUpdateTask } from './useUpdateTask.ts'

type EditTaskDraft = {
    title: string
    description: string
    /** `YYYY-MM-DD` — значение `<input type="date">`, тот же приём, что `CreateTask`'s
     * `useCreateTaskForm`'s `CreateTaskDraft.deadline`; здесь приводится из `Task.deadline`.
     * Контракт типизирует его как `Date` (`z.coerce.date()`), но фронт не прогоняет ответы API
     * через эту схему — по факту это ISO-строка из JSON, не `Date` (тот же случай, что
     * `TaskStatusCard.tsx`'s `formatDeadline`), поэтому оборачиваем в `new Date(...)` перед
     * `toISOString()`. */
    deadline: string
    assigneeEmployeeId: number | null
}

function draftFromTask(task: Task): EditTaskDraft {
    return {
        title: task.title,
        description: task.description ?? '',
        deadline: new Date(task.deadline).toISOString().slice(0, 10),
        assigneeEmployeeId: task.assigneeEmployeeId,
    }
}

/**
 * edit-task, tasks.md группа 6 — плоский объект состояния формы редактирования задачи
 * (frontend/CLAUDE.md, "model-хуки с плоским объектом состояния"), по прецеденту
 * `CreateTask/model/useCreateTaskForm.ts`. Черновик инициализируется один раз из `task`, переданной
 * при входе в режим редактирования (design.md Decision 5: `TaskStatusControl` монтирует этот хук
 * только когда `isEditing === true`, поэтому свежий `task` уже известен на момент инициализации —
 * ре-синхронизация при последующих изменениях пропа `task` не нужна, в отличие от
 * `defaultAssigneeEmployeeId` у `useCreateTaskForm`).
 *
 * `save()` отправляет ВСЕ поля черновика (design.md Decision 5), не только изменённые —
 * партиальность контракта `UpdateTaskRequest` (change 3, `tasksApi.update`) используется другими
 * вызывающими (например, точечными PATCH из будущих сценариев), не обязательна здесь.
 */
export function useEditTaskForm(task: Task, onSaved?: () => void) {
    const [draft, setDraft] = useState<EditTaskDraft>(() => draftFromTask(task))
    const updateTask = useUpdateTask(task.id)

    function patch(partial: Partial<EditTaskDraft>) {
        setDraft((prev) => ({ ...prev, ...partial }))
    }

    const canSave = draft.title.trim() !== '' && draft.deadline !== '' && draft.assigneeEmployeeId !== null

    function save() {
        if (!canSave || draft.assigneeEmployeeId === null) return

        updateTask.mutate(
            {
                title: draft.title.trim(),
                description: draft.description.trim() === '' ? undefined : draft.description.trim(),
                deadline: draft.deadline,
                assigneeEmployeeId: draft.assigneeEmployeeId,
            },
            { onSuccess: () => onSaved?.() },
        )
    }

    return {
        draft,
        patch,
        canSave,
        save,
        isPending: updateTask.isPending,
        error: updateTask.error,
    }
}
