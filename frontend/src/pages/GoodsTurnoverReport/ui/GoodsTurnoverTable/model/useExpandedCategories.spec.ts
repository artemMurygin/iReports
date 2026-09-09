import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useExpandedCategories } from './useExpandedCategories.ts'

// Строки начинают жизнь свёрнутыми по умолчанию (по запросу пользователя, после того как
// сворачивание/разворачивание вообще появилось в таблице) — хук хранит id, которые пользователь
// явно РАЗВЕРНУЛ, а не наоборот, поэтому категория без единого клика по ней всегда "свёрнута",
// независимо от того, когда она появилась в дереве (смена склада/периода не требует отдельной
// синхронизации состояния с новым набором строк).
describe('useExpandedCategories', () => {
    it('starts with nothing expanded — every category is collapsed by default', () => {
        const { result } = renderHook(() => useExpandedCategories())

        expect(result.current.isExpanded(1)).toBe(false)
    })

    it('toggle expands a category, a second toggle collapses it back', () => {
        const { result } = renderHook(() => useExpandedCategories())

        act(() => result.current.toggle(1))
        expect(result.current.isExpanded(1)).toBe(true)

        act(() => result.current.toggle(1))
        expect(result.current.isExpanded(1)).toBe(false)
    })

    it('tracks multiple expanded categories independently', () => {
        const { result } = renderHook(() => useExpandedCategories())

        act(() => result.current.toggle(1))
        act(() => result.current.toggle(2))

        expect(result.current.isExpanded(1)).toBe(true)
        expect(result.current.isExpanded(2)).toBe(true)
        expect(result.current.isExpanded(3)).toBe(false)
    })
})
