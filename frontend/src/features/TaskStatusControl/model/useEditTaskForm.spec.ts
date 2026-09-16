import type { ReactNode } from 'react'
import { createElement } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useEditTaskForm } from './useEditTaskForm.ts'

/**
 * edit-task, tasks.md группа 6: `useEditTaskForm` — плоский объект состояния формы редактирования
 * задачи (frontend/CLAUDE.md, "model-хуки с плоским объектом состояния"), по прецеденту
 * `CreateTask/model/useCreateTaskForm.spec.ts` для формы черновика/`patch`/`canSave`, и
 * `useUpdateTask.spec.tsx` для мока сети (мокаем `@/shared/api/axios.instance.ts`, не сам
 * `useUpdateTask` — хук композирует реальную мутацию поверх реального `QueryClient`).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const TASK: Task = {
    id: 'task-1',
    direction: 'service',
    title: 'Проверить отчёт по кассе',
    description: 'Сверить суммы начислений за месяц',
    // Контракт типизирует `deadline` как `Date`, но реальный ответ API — ISO-строка из JSON (см. WHY
    // в `useEditTaskForm.ts`'s `draftFromTask`) — строка здесь, а не `new Date(...)`, чтобы тест не
    // маскировал этот случай (баг `task.deadline.toISOString is not a function` воспроизводился
    // именно потому, что соседние тесты фичи мокали `deadline` уже как `Date`).
    deadline: '2026-09-30T00:00:00.000Z' as unknown as Date,
    assigneeEmployeeId: 7,
    status: 'IN_PROGRESS',
    closedSuccessfullyAt: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
}

function makeQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function renderEditTaskForm(task: Task, onSaved?: () => void, queryClient: QueryClient = makeQueryClient()) {
    function wrapper({ children }: { children: ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children)
    }
    return renderHook(() => useEditTaskForm(task, onSaved), { wrapper })
}

describe('useEditTaskForm', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.patch).mockReset()
    })

    it('инициализирует draft из переданной задачи, приводя deadline к YYYY-MM-DD', () => {
        const { result } = renderEditTaskForm(TASK)

        expect(result.current.draft).toEqual({
            title: 'Проверить отчёт по кассе',
            description: 'Сверить суммы начислений за месяц',
            deadline: '2026-09-30',
            assigneeEmployeeId: 7,
        })
    })

    it('подставляет пустую строку в description, если у задачи оно null', () => {
        const { result } = renderEditTaskForm({ ...TASK, description: null })

        expect(result.current.draft.description).toBe('')
    })

    it('patch(partial) меняет только указанные поля черновика', () => {
        const { result } = renderEditTaskForm(TASK)

        act(() => result.current.patch({ title: 'Новый заголовок' }))

        expect(result.current.draft).toEqual({
            title: 'Новый заголовок',
            description: 'Сверить суммы начислений за месяц',
            deadline: '2026-09-30',
            assigneeEmployeeId: 7,
        })
    })

    it('canSave — false, если title пуст после trim', () => {
        const { result } = renderEditTaskForm(TASK)

        act(() => result.current.patch({ title: '   ' }))

        expect(result.current.canSave).toBe(false)
    })

    it('canSave — false, если deadline пуст', () => {
        const { result } = renderEditTaskForm(TASK)

        act(() => result.current.patch({ deadline: '' }))

        expect(result.current.canSave).toBe(false)
    })

    it('canSave — false, если assigneeEmployeeId === null', () => {
        const { result } = renderEditTaskForm(TASK)

        act(() => result.current.patch({ assigneeEmployeeId: null }))

        expect(result.current.canSave).toBe(false)
    })

    it('canSave — true для валидного черновика (значения по умолчанию из задачи)', () => {
        const { result } = renderEditTaskForm(TASK)

        expect(result.current.canSave).toBe(true)
    })

    it('save() вызывает PATCH /v1/tasks/:id с обрезанными title/description и текущим черновиком', async () => {
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: TASK })
        const { result } = renderEditTaskForm(TASK)

        act(() => result.current.patch({ title: '  Обновлённый заголовок  ' }))
        act(() => result.current.save())

        await waitFor(() => expect(axiosInstance.patch).toHaveBeenCalled())

        expect(axiosInstance.patch).toHaveBeenCalledWith('/v1/tasks/task-1', {
            title: 'Обновлённый заголовок',
            description: 'Сверить суммы начислений за месяц',
            deadline: '2026-09-30',
            assigneeEmployeeId: 7,
        })
    })

    it('save() отправляет description как undefined, если он пуст после trim', async () => {
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: TASK })
        const { result } = renderEditTaskForm({ ...TASK, description: null })

        act(() => result.current.save())

        await waitFor(() => expect(axiosInstance.patch).toHaveBeenCalled())

        expect(axiosInstance.patch).toHaveBeenCalledWith('/v1/tasks/task-1', {
            title: 'Проверить отчёт по кассе',
            description: undefined,
            deadline: '2026-09-30',
            assigneeEmployeeId: 7,
        })
    })

    it('save() на успехе вызывает переданный onSaved', async () => {
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: TASK })
        const onSaved = vi.fn()
        const { result } = renderEditTaskForm(TASK, onSaved)

        act(() => result.current.save())

        await waitFor(() => expect(onSaved).toHaveBeenCalled())
    })

    it('возвращает isPending/error из мутации useUpdateTask', () => {
        const { result } = renderEditTaskForm(TASK)

        expect(result.current.isPending).toBe(false)
        expect(result.current.error).toBeNull()
    })
})
