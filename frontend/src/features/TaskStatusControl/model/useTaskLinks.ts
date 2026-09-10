import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { TASK_LINKS_QUERY_KEY_PREFIX, linksApi } from './api.ts'

function isValidUrl(value: string): boolean {
    try {
        new URL(value)
        return true
    } catch {
        return false
    }
}

/**
 * add-task-salary-rule-links-comments, tasks.md группа 23 — ссылки карточки задачи
 * (`TaskLinksSection`). `spec: tasks/links#Requirement: Ссылка должна быть валидным адресом`:
 * `addLink` с синтаксически невалидным URL не уходит в `POST /v1/tasks/:id/links` — тот же приём
 * валидации до отправки, что и `useTaskComments`'s проверка пустого текста (домен на бэкенде уже
 * защищён `TaskLinkUrl`, здесь — только UI-предохранитель, без лишнего round-trip).
 */
export function useTaskLinks(taskId: string) {
    const queryClient = useQueryClient()
    const { data, error: listError } = useQuery(linksApi.list(taskId))
    const [validationError, setValidationError] = useState<Error | null>(null)

    function invalidate() {
        void queryClient.invalidateQueries({ queryKey: [...TASK_LINKS_QUERY_KEY_PREFIX, taskId] })
    }

    const addMutation = useMutation({
        mutationFn: ({ url, label }: { url: string; label?: string }) => linksApi.create(taskId, url, label),
        onSuccess: invalidate,
    })

    const removeMutation = useMutation({
        mutationFn: (linkId: string) => linksApi.remove(taskId, linkId),
        onSuccess: invalidate,
    })

    function addLink(url: string, label?: string) {
        if (!isValidUrl(url)) {
            setValidationError(new Error('Ссылка должна быть валидным адресом'))
            return
        }
        setValidationError(null)
        addMutation.mutate({ url, label })
    }

    function removeLink(linkId: string) {
        removeMutation.mutate(linkId)
    }

    return {
        links: data ?? [],
        addLink,
        removeLink,
        error: validationError ?? listError ?? addMutation.error ?? removeMutation.error,
    }
}
