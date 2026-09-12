import { useState } from 'react'

import { api } from './api.ts'
import { useCreateTask } from './useCreateTask.ts'

type CreateTaskDraft = {
    title: string
    description: string
    /** `YYYY-MM-DD` — значение `<input type="date">`, отправляется как есть (ISO-строка, парсится
     * `Date.parse` и на бэкенде `new Date(...)`, см. `create-task.http.controller.ts`). */
    deadline: string
    assigneeEmployeeId: number | null
}

/** Ссылка ещё не созданной задачи — локальный черновик до `POST /v1/tasks`, у неё пока нет `id`. */
type DraftLink = { url: string; label?: string }

const EMPTY_DRAFT: CreateTaskDraft = { title: '', description: '', deadline: '', assigneeEmployeeId: null }

function isValidUrl(value: string): boolean {
    try {
        new URL(value)
        return true
    } catch {
        return false
    }
}

/**
 * replace-bitrix-task-integration, раздел 11 tasks.md — плоский объект состояния формы создания
 * задачи (frontend/CLAUDE.md, "model-хуки с плоским объектом состояния"): держит черновик полей,
 * простую required-валидацию (`canSubmit`) и композирует `useCreateTask` — на успехе сбрасывает
 * черновик и уведомляет вызывающего через `onCreated(taskId)`, чтобы и общая страница `/tasks`
 * (закрыть модалку/обновить список), и Шаг 1 мастера создания правила `TaskCompletion`
 * (перейти к Шагу 2, уже зная `taskId`) могли отреагировать без знания о внутреннем стейте формы.
 *
 * `links` — черновичный список ссылок, собираемый ДО того, как задача существует (у неё ещё нет
 * `id`, поэтому `POST /v1/tasks/:id/links` невозможен). После успешного `createTask` каждая ссылка
 * прикрепляется отдельным последовательным запросом (`api.addLink`, см. WHY в `api.ts`) — задача уже
 * создана и видна независимо от исхода прикрепления ссылок, поэтому `onCreated` вызывается в любом
 * случае, а неудачные ссылки остаются в `linksError` для отображения.
 *
 * `defaultAssigneeEmployeeId` — add-task-rule-employee-assignee: когда форма открыта из карточки
 * правила `TaskCompletion` (`features/SalaryRuleForm`'s "Создать задачу"), правило может ссылаться
 * только на личную схему конкретного сотрудника (`TaskCompletionRequiresPersonalSchemaException`
 * запрещает схему отдела), поэтому исполнитель новой задачи почти всегда совпадает с сотрудником
 * схемы — страница передаёт его id сюда вместо `null`. Значение подставляется во время рендера (по
 * образцу React'а "Adjusting state when a prop changes", не через `useEffect`+`setState` — на
 * странице создания схемы (`pages/SalaryRules`) сотрудник может быть выбран уже ПОСЛЕ того, как эта
 * форма смонтирована: панель рендерится безусловно, `CreateTaskPanel`'s `open` только скрывает её),
 * поэтому `defaultAssigneeEmployeeId` отслеживается через `prevDefaultAssigneeEmployeeId` и
 * применяется заново при каждом его изменении. Условие `draft.assigneeEmployeeId === null`
 * подставляет значение только пока поле ещё пустое — если пользователь уже выбрал исполнителя сам
 * (в т.ч. другого), более поздняя подстановка его не перезатирает.
 */
export function useCreateTaskForm(onCreated?: (taskId: string) => void, defaultAssigneeEmployeeId: number | null = null) {
    const [draft, setDraft] = useState<CreateTaskDraft>(() => ({ ...EMPTY_DRAFT, assigneeEmployeeId: defaultAssigneeEmployeeId }))
    const [links, setLinks] = useState<DraftLink[]>([])
    const [linksError, setLinksError] = useState<Error | null>(null)
    const [isAttachingLinks, setIsAttachingLinks] = useState(false)
    const [prevDefaultAssigneeEmployeeId, setPrevDefaultAssigneeEmployeeId] = useState(defaultAssigneeEmployeeId)
    const createTask = useCreateTask()

    if (defaultAssigneeEmployeeId !== prevDefaultAssigneeEmployeeId) {
        setPrevDefaultAssigneeEmployeeId(defaultAssigneeEmployeeId)
        if (defaultAssigneeEmployeeId !== null && draft.assigneeEmployeeId === null) {
            setDraft((prev) => ({ ...prev, assigneeEmployeeId: defaultAssigneeEmployeeId }))
        }
    }

    function patch(partial: Partial<CreateTaskDraft>) {
        setDraft((prev) => ({ ...prev, ...partial }))
    }

    function addLink(url: string, label?: string) {
        if (!isValidUrl(url)) {
            setLinksError(new Error('Ссылка должна быть валидным адресом'))
            return
        }
        setLinksError(null)
        setLinks((prev) => [...prev, { url, label }])
    }

    function removeLink(index: number) {
        setLinks((prev) => prev.filter((_, i) => i !== index))
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
                onSuccess: async (response) => {
                    const pendingLinks = links
                    setDraft({ ...EMPTY_DRAFT, assigneeEmployeeId: defaultAssigneeEmployeeId })
                    setLinks([])

                    if (pendingLinks.length > 0) {
                        setIsAttachingLinks(true)
                        const results = await Promise.allSettled(
                            pendingLinks.map((link) => api.addLink(response.id, link.url, link.label)),
                        )
                        setIsAttachingLinks(false)
                        if (results.some((result) => result.status === 'rejected')) {
                            setLinksError(new Error('Задача создана, но часть ссылок прикрепить не удалось'))
                        }
                    }

                    onCreated?.(response.id)
                },
            },
        )
    }

    return {
        draft,
        patch,
        links,
        addLink,
        removeLink,
        canSubmit,
        submit,
        isPending: createTask.isPending || isAttachingLinks,
        error: createTask.error ?? linksError,
    }
}
