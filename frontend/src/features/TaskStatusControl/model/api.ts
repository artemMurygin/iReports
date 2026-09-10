import { queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import type {
    ChangeTaskStatusRequest,
    ListEmployeesResponse,
    SalaryAccrualLineSummary,
    SalaryRuleSummary,
    Task,
    TaskComment,
    TaskDirection,
    TaskLink,
    TaskStatus,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError, extractApiErrorMessage } from '@/shared/errors/apiError.ts'

/**
 * replace-bitrix-task-integration, tasks.md группа 12 — карточка статуса самостоятельной задачи
 * (`GET /v1/tasks/:id`) и self-service переход по графу `TaskStatus` (`PATCH /v1/tasks/:id/status`,
 * specs/tasks/spec.md «Ответственный сотрудник ведёт задачу до готовности» / «Проверка и закрытие
 * задачи руководителем» / «Возврат с доработки в работу»). `actorEmployeeId` резолвится backend'ом
 * из сессии (см. WHY в `ChangeTaskStatusHttpController`) — тело запроса несёт только `targetStatus`.
 *
 * `getAssigneeEmployees` — своя копия справочника сотрудников (`GET /v1/directory/employees`), не
 * импорт `features/CreateTask`/`features/TargetDirectory`: features не могут кросс-импортировать
 * друг друга (frontend/CLAUDE.md, `boundaries/dependencies`) — тот же приём дублирования читающего
 * запроса, что уже задокументирован в `features/CreateTask/model/api.ts`'s `getEmployees`. Нужна
 * здесь только для того, чтобы показать имя ответственного (`Task.assigneeEmployeeId` — просто
 * число, без имени) — отдельный `queryKey`, не пересекающийся с кэшем других фич.
 */
export const TASKS_QUERY_KEY_PREFIX = ['tasks'] as const

export const tasksApi = {
    get: (taskId: string) =>
        queryOptions({
            queryKey: [...TASKS_QUERY_KEY_PREFIX, taskId],
            queryFn: ({ signal }): Promise<Task> =>
                apiInstance
                    .get<Task>(`/v1/tasks/${taskId}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить задачу ' + error)
                    }),
        }),

    // Ошибка НЕ оборачивается в ApiError — по прецеденту `EmployeeBalance/model/api.ts`'s
    // `createTransaction`: недопустимый переход (`InvalidTaskTransitionException`) отдаёт 400 с
    // читаемым `message`, который читает `extractApiErrorMessage` в самом UI-обработчике мутации.
    transition: (taskId: string, payload: ChangeTaskStatusRequest): Promise<Task> =>
        apiInstance.patch<Task>(`/v1/tasks/${taskId}/status`, payload).then((r) => r.data),

    getAssigneeEmployees: () =>
        queryOptions({
            queryKey: ['task-status-control', 'employees'],
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListEmployeesResponse> =>
                apiInstance
                    .get<ListEmployeesResponse>('/v1/directory/employees', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список сотрудников ' + error)
                    }),
        }),
}

export function readTransitionErrorMessage(error: unknown): string {
    return extractApiErrorMessage(error, 'Не удалось изменить статус задачи')
}

/**
 * add-task-salary-rule-links-comments, tasks.md группа 21 — комментарии карточки задачи
 * (`GET`/`POST /v1/tasks/:id/comments`, architecture.md «HTTP-эндпоинты»). Автор комментария
 * резолвится backend'ом из сессии (`SessionAuthGuard`), тело `create` несёт только текст —
 * `spec: tasks/comments#Requirement: Комментарий фиксирует автора, время и текст`.
 */
export const TASK_COMMENTS_QUERY_KEY_PREFIX = ['task-comments'] as const

export const commentsApi = {
    list: (taskId: string) =>
        queryOptions({
            queryKey: [...TASK_COMMENTS_QUERY_KEY_PREFIX, taskId],
            queryFn: ({ signal }): Promise<TaskComment[]> =>
                apiInstance
                    .get<TaskComment[]>(`/v1/tasks/${taskId}/comments`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить комментарии задачи ' + error)
                    }),
        }),

    create: (taskId: string, text: string): Promise<TaskComment> =>
        apiInstance.post<TaskComment>(`/v1/tasks/${taskId}/comments`, { text }).then((r) => r.data),
}

/**
 * Ссылки карточки задачи (`GET`/`POST /v1/tasks/:id/links`, `DELETE /v1/tasks/:id/links/:linkId`) —
 * `spec: tasks/links#Requirement: Задача может иметь несколько ссылок`. Валидация URL до отправки —
 * в `useTaskLinks` (модель), не здесь: этот слой только формирует запрос.
 */
export const TASK_LINKS_QUERY_KEY_PREFIX = ['task-links'] as const

export const linksApi = {
    list: (taskId: string) =>
        queryOptions({
            queryKey: [...TASK_LINKS_QUERY_KEY_PREFIX, taskId],
            queryFn: ({ signal }): Promise<TaskLink[]> =>
                apiInstance
                    .get<TaskLink[]>(`/v1/tasks/${taskId}/links`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить ссылки задачи ' + error)
                    }),
        }),

    create: (taskId: string, url: string, label?: string): Promise<TaskLink> =>
        apiInstance.post<TaskLink>(`/v1/tasks/${taskId}/links`, { url, label }).then((r) => r.data),

    remove: (taskId: string, linkId: string): Promise<void> =>
        apiInstance.delete<void>(`/v1/tasks/${taskId}/links/${linkId}`).then((r) => r.data),
}

function accountingBasePath(direction: TaskDirection): string {
    return direction === 'shop' ? '/v1/shop/accounting' : '/v1/service/accounting'
}

/**
 * Правило/начисление за задачу (`GET .../salary-rules/by-task/:taskId`,
 * `GET .../salary-accrual-lines/by-task/:taskId`, architecture.md «HTTP-эндпоинты», по домену
 * `direction`) — карточка задачи для блока `SalaryRuleSummaryBlock`
 * (`useTaskSalaryReference(task)`). Backend отдаёт 404, если правило/начисление не найдено
 * (architecture.md: «404/null») — та же схема, что и `SalaryReportData/model/api.ts`'s
 * `getEmployeeSalaryReport`: 404 сворачивается в `null`, любая другая ошибка — в `ApiError`.
 */
export const TASK_SALARY_REFERENCE_QUERY_KEY_PREFIX = ['task-salary-reference'] as const

export const salaryReferenceApi = {
    getRule: (direction: TaskDirection, taskId: string) =>
        queryOptions({
            queryKey: [...TASK_SALARY_REFERENCE_QUERY_KEY_PREFIX, 'rule', direction, taskId],
            queryFn: ({ signal }): Promise<SalaryRuleSummary | null> =>
                apiInstance
                    .get<SalaryRuleSummary>(`${accountingBasePath(direction)}/salary-rules/by-task/${taskId}`, {
                        signal,
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        if (isAxiosError(error) && error.response?.status === 404) return null
                        throw new ApiError('Не удалось загрузить зарплатное правило задачи ' + error)
                    }),
        }),

    getAccrual: (direction: TaskDirection, taskId: string) =>
        queryOptions({
            queryKey: [...TASK_SALARY_REFERENCE_QUERY_KEY_PREFIX, 'accrual', direction, taskId],
            queryFn: ({ signal }): Promise<SalaryAccrualLineSummary | null> =>
                apiInstance
                    .get<SalaryAccrualLineSummary>(
                        `${accountingBasePath(direction)}/salary-accrual-lines/by-task/${taskId}`,
                        { signal },
                    )
                    .then((r) => r.data)
                    .catch((error) => {
                        if (isAxiosError(error) && error.response?.status === 404) return null
                        throw new ApiError('Не удалось загрузить начисление по задаче ' + error)
                    }),
        }),
}

export type { TaskStatus }
