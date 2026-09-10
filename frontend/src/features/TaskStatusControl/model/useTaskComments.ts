import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { TASK_COMMENTS_QUERY_KEY_PREFIX, commentsApi } from './api.ts'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 22 — комментарии карточки задачи
 * (`TaskCommentsSection`). `spec: tasks/comments#Requirement: Пустой комментарий отклоняется`:
 * `addComment` с пустым/пробельным текстом не уходит в `POST /v1/tasks/:id/comments` — тот же приём
 * валидации до отправки, что и `useTaskLinks`'s проверка URL, только доменное правило здесь проще
 * (пустой/пробельный текст), поэтому проверяется прямо в хуке, без отдельного VO на фронтенде
 * (домен на бэкенде уже защищён `TaskCommentBody`).
 */
export function useTaskComments(taskId: string) {
    const queryClient = useQueryClient()
    const { data, error: listError } = useQuery(commentsApi.list(taskId))
    const [validationError, setValidationError] = useState<Error | null>(null)

    const mutation = useMutation({
        mutationFn: (text: string) => commentsApi.create(taskId, text),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: [...TASK_COMMENTS_QUERY_KEY_PREFIX, taskId] })
        },
    })

    function addComment(text: string) {
        if (text.trim() === '') {
            setValidationError(new Error('Комментарий не может быть пустым'))
            return
        }
        setValidationError(null)
        mutation.mutate(text)
    }

    return {
        comments: data ?? [],
        addComment,
        isAdding: mutation.isPending,
        error: validationError ?? listError ?? mutation.error,
    }
}
