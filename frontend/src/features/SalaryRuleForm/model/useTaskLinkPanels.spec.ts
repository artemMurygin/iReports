import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { salaryRuleTaskApi } from './taskApi.ts'
import { useTaskLinkPanels } from './useTaskLinkPanels.ts'

/**
 * add-task-rule-task-lifecycle — задача, созданная через панель "Создать задачу", уже реальная
 * строка в БД, а правило `TaskCompletion`, которому она принадлежит, всё ещё живёт только в
 * клиентском черновике до отдельного "Сохранить схему". `spec: tasks/spec.md#Requirement:
 * Осиротевшая задача правила удаляется, если правило не сохранено` — если пользователь уходит со
 * страницы, так и не сохранив схему, такая задача удаляется молча при размонтировании; если
 * `markTasksSaved()` был вызван (схема успешно сохранена), она остаётся нетронутой.
 */
vi.mock('./taskApi.ts', () => ({
    salaryRuleTaskApi: { remove: vi.fn() },
}))

describe('useTaskLinkPanels', () => {
    beforeEach(() => {
        vi.mocked(salaryRuleTaskApi.remove).mockReset()
        vi.mocked(salaryRuleTaskApi.remove).mockResolvedValue(undefined)
    })

    it('пишет taskId созданной задачи в черновик через onChange', () => {
        const onChange = vi.fn()
        const { result } = renderHook(() => useTaskLinkPanels(onChange))

        act(() => result.current.requestCreateTask('draft-1'))
        act(() => result.current.handleTaskCreated('task-1'))

        expect(onChange).toHaveBeenCalledWith('draft-1', { taskId: 'task-1' })
        expect(result.current.isCreatingTask).toBe(false)
    })

    it('удаляет задачу, созданную за время жизни формы, при размонтировании без сохранения схемы', () => {
        const onChange = vi.fn()
        const { result, unmount } = renderHook(() => useTaskLinkPanels(onChange))

        act(() => result.current.requestCreateTask('draft-1'))
        act(() => result.current.handleTaskCreated('task-1'))

        unmount()

        expect(salaryRuleTaskApi.remove).toHaveBeenCalledWith('task-1')
    })

    it('не удаляет задачу при размонтировании, если markTasksSaved уже был вызван', () => {
        const onChange = vi.fn()
        const { result, unmount } = renderHook(() => useTaskLinkPanels(onChange))

        act(() => result.current.requestCreateTask('draft-1'))
        act(() => result.current.handleTaskCreated('task-1'))
        act(() => result.current.markTasksSaved())

        unmount()

        expect(salaryRuleTaskApi.remove).not.toHaveBeenCalled()
    })

    it('не трогает задачу, ни разу не созданную через панель этого хука (уже сохранённое правило)', () => {
        const onChange = vi.fn()
        const { unmount } = renderHook(() => useTaskLinkPanels(onChange))

        unmount()

        expect(salaryRuleTaskApi.remove).not.toHaveBeenCalled()
    })
})
