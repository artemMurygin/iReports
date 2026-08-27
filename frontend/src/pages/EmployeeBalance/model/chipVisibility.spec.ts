import { describe, expect, it } from 'vitest'

import { splitVisibleChips } from './chipVisibility.ts'

describe('splitVisibleChips', () => {
    it('splits the first N items as visible and the rest as hidden', () => {
        const result = splitVisibleChips(['a', 'b', 'c', 'd', 'e', 'f'], 4)
        expect(result.visible).toEqual(['a', 'b', 'c', 'd'])
        expect(result.hidden).toEqual(['e', 'f'])
    })

    it('hides nothing when the list already fits', () => {
        const result = splitVisibleChips(['a', 'b'], 5)
        expect(result.visible).toEqual(['a', 'b'])
        expect(result.hidden).toEqual([])
    })

    it('hides everything when visibleCount is 0', () => {
        const result = splitVisibleChips(['a', 'b'], 0)
        expect(result.visible).toEqual([])
        expect(result.hidden).toEqual(['a', 'b'])
    })

    it('throws on a negative visibleCount', () => {
        expect(() => splitVisibleChips(['a'], -1)).toThrow()
    })
})
