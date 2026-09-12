import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useCreateTaskForm } from './useCreateTaskForm.ts'

/**
 * add-task-rule-employee-assignee — при открытии из карточки правила `TaskCompletion` ответственный
 * задачи должен предзаполняться сотрудником, на схему которого заведено правило.
 */
vi.mock('./useCreateTask.ts', () => ({
    useCreateTask: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}))

describe('useCreateTaskForm — defaultAssigneeEmployeeId', () => {
    it('оставляет ответственного пустым, если умолчание не передано', () => {
        const { result } = renderHook(() => useCreateTaskForm())

        expect(result.current.draft.assigneeEmployeeId).toBeNull()
    })

    it('предзаполняет ответственного переданным сотрудником схемы', () => {
        const { result } = renderHook(() => useCreateTaskForm(undefined, 42))

        expect(result.current.draft.assigneeEmployeeId).toBe(42)
    })

    it('подставляет умолчание, появившееся после монтирования, если поле ещё не тронуто', () => {
        const { result, rerender } = renderHook(({ defaultId }) => useCreateTaskForm(undefined, defaultId), {
            initialProps: { defaultId: null as number | null },
        })

        expect(result.current.draft.assigneeEmployeeId).toBeNull()

        rerender({ defaultId: 7 })

        expect(result.current.draft.assigneeEmployeeId).toBe(7)
    })

    it('не перезатирает уже выбранного вручную ответственного при смене умолчания', () => {
        const { result, rerender } = renderHook(({ defaultId }) => useCreateTaskForm(undefined, defaultId), {
            initialProps: { defaultId: 7 as number | null },
        })
        expect(result.current.draft.assigneeEmployeeId).toBe(7)

        act(() => result.current.patch({ assigneeEmployeeId: 99 }))
        rerender({ defaultId: 15 })

        expect(result.current.draft.assigneeEmployeeId).toBe(99)
    })
})
