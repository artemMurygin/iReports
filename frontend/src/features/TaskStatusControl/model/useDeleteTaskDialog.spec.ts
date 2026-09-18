import { describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

import { useDeleteTaskDialog } from './useDeleteTaskDialog.ts'

/**
 * delete-task-frontend, tasks.md группа 2 — `useDeleteTaskDialog`: confirm-хук по образцу
 * `useDeleteRuleTask` (`features/SalaryRuleForm/model/useDeleteRuleTask.ts`). Хук не знает про
 * конкретное API удаления — `confirm(action)` просто запускает переданный async-колбэк, тесты
 * поэтому используют произвольные `vi.fn()`-раннеры, а не реальный `tasksApi.remove`.
 */
describe('useDeleteTaskDialog', () => {
    it('open()/close() переключают isOpen', () => {
        const { result } = renderHook(() => useDeleteTaskDialog())

        expect(result.current.isOpen).toBe(false)

        act(() => {
            result.current.open()
        })
        expect(result.current.isOpen).toBe(true)

        act(() => {
            result.current.close()
        })
        expect(result.current.isOpen).toBe(false)
    })

    it('confirm(action) вызывает переданное async-действие и держит isPending === true во время выполнения', async () => {
        const { result } = renderHook(() => useDeleteTaskDialog())

        let resolveAction: () => void = () => {}
        const action = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveAction = resolve
                }),
        )

        act(() => {
            result.current.open()
        })

        let confirmPromise: Promise<void> = Promise.resolve()
        act(() => {
            confirmPromise = result.current.confirm(action)
        })

        await waitFor(() => expect(result.current.isPending).toBe(true))
        expect(action).toHaveBeenCalledTimes(1)

        act(() => {
            resolveAction()
        })
        await act(async () => {
            await confirmPromise
        })

        expect(result.current.isPending).toBe(false)
    })

    it('при успехе action диалог закрывается и error === null', async () => {
        const { result } = renderHook(() => useDeleteTaskDialog())
        const action = vi.fn().mockResolvedValue(undefined)

        act(() => {
            result.current.open()
        })
        expect(result.current.isOpen).toBe(true)

        await act(async () => {
            await result.current.confirm(action)
        })

        expect(result.current.isOpen).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.isPending).toBe(false)
    })

    it('при ошибке action диалог остаётся открытым, error заполнен, isPending возвращается в false', async () => {
        const { result } = renderHook(() => useDeleteTaskDialog())
        const action = vi.fn().mockRejectedValue(new Error('Не удалось удалить задачу'))

        act(() => {
            result.current.open()
        })

        await act(async () => {
            await result.current.confirm(action)
        })

        expect(result.current.isOpen).toBe(true)
        expect(result.current.error).toBe('Не удалось удалить задачу')
        expect(result.current.isPending).toBe(false)
    })
})
