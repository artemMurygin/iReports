import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Task, TaskDirection, TaskStatus } from 'ireports-contracts'

import { TASKS_LIST_QUERY_KEY_PREFIX, tasksApi } from './api.ts'

export type TaskStatusFilter = 'all' | TaskStatus
export type TaskDirectionFilter = 'all' | TaskDirection

/**
 * replace-bitrix-task-integration, tasks.md 13.1/13.3 — плоский стейт-хук единственного
 * stateful-виджета страницы `/tasks` (architecture.md: «`pages/Tasks` по-прежнему обходится без
 * mediator»). Фильтры статуса/направления идут в query (`GET /v1/tasks?status&direction`,
 * серверная фильтрация); `search` — локальный текстовый фильтр по уже загруженной странице
 * (бэкенд `ListTasksQuery`, ireports-contracts, не принимает текстовый поиск).
 *
 * `placeholderData: keepPreviousData` — смена `statusFilter`/`directionFilter` не «схлопывает» уже
 * отрисованный список: во время рефетча под новый фильтр `data` остаётся прежним, поэтому
 * `isRefreshing` (не `isInitialLoad`) — тот же приём, что `useServicesAnalytics`/`useDeals`
 * (frontend/CLAUDE.md, «isInitialLoad / isRefreshing вместо единого isLoading»).
 */
export function useTasksPage() {
    const queryClient = useQueryClient()

    const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all')
    const [directionFilter, setDirectionFilter] = useState<TaskDirectionFilter>('all')
    const [search, setSearch] = useState('')
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [isCreateOpen, setIsCreateOpen] = useState(false)

    const {
        data,
        isFetching,
        error: queryError,
    } = useQuery({
        ...tasksApi.list({
            status: statusFilter === 'all' ? undefined : statusFilter,
            direction: directionFilter === 'all' ? undefined : directionFilter,
        }),
        placeholderData: keepPreviousData,
    })

    const hasLoadedOnce = data !== undefined
    const isInitialLoad = isFetching && !hasLoadedOnce
    const isRefreshing = isFetching && hasLoadedOnce

    const tasks = useMemo<Task[]>(() => {
        const list = data ?? []
        const query = search.trim().toLowerCase()
        if (query === '') return list
        return list.filter((task) => task.title.toLowerCase().includes(query))
    }, [data, search])

    function resetFilters() {
        setStatusFilter('all')
        setDirectionFilter('all')
        setSearch('')
    }

    function openCreateModal() {
        setIsCreateOpen(true)
    }

    function closeCreateModal() {
        setIsCreateOpen(false)
    }

    // `useTaskTransition` (features/TaskStatusControl, группа 12) уже инвалидирует весь префикс
    // `['tasks']` на успешный переход — созданная задача попадает под тот же префикс
    // (`TASKS_LIST_QUERY_KEY_PREFIX = ['tasks', 'list']`), поэтому здесь достаточно инвалидировать
    // именно список, не весь `['tasks']` (карточка ещё не открытой задачи инвалидировать незачем).
    function handleTaskCreated() {
        void queryClient.invalidateQueries({ queryKey: TASKS_LIST_QUERY_KEY_PREFIX })
        setIsCreateOpen(false)
    }

    return {
        tasks,
        isInitialLoad,
        isRefreshing,
        error: queryError ? queryError.message : null,
        statusFilter,
        setStatusFilter,
        directionFilter,
        setDirectionFilter,
        search,
        setSearch,
        hasTasks: tasks.length > 0,
        resetFilters,
        selectedTaskId,
        openTaskDetail: setSelectedTaskId,
        closeTaskDetail: () => setSelectedTaskId(null),
        isCreateOpen,
        openCreateModal,
        closeCreateModal,
        onTaskCreated: handleTaskCreated,
    }
}

export type TasksPageState = ReturnType<typeof useTasksPage>
