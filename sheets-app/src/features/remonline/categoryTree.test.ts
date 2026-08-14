import { describe, expect, it } from 'vitest'
import { buildCategoryTree, getSelectedCategoryPath } from './categoryTree'
import type { ServiceCategory } from '@/shared/gas/types'

const CATEGORIES: ServiceCategory[] = [
    { id: 1, name: 'Ремонт', parentId: null },
    { id: 2, name: 'Диагностика', parentId: null },
    { id: 10, name: 'iPhone', parentId: 1 },
    { id: 11, name: 'iPad', parentId: 1 },
    { id: 100, name: 'Замена экрана ', parentId: 10 }, // trailing space, exercises byName trim
]

describe('buildCategoryTree', () => {
    it('groups categories by parentId, using null as the key for roots', () => {
        const tree = buildCategoryTree(CATEGORIES)

        expect(tree.byParent.get(null)).toEqual([CATEGORIES[0], CATEGORIES[1]])
        expect(tree.byParent.get(1)).toEqual([CATEGORIES[2], CATEGORIES[3]])
        expect(tree.byParent.get(10)).toEqual([CATEGORIES[4]])
        expect(tree.byParent.get(11)).toBeUndefined()
    })

    it('indexes byId and byName (trimmed) for every category', () => {
        const tree = buildCategoryTree(CATEGORIES)

        expect(tree.byId.get(100)?.name).toBe('Замена экрана ')
        expect(tree.byName.get('Замена экрана')).toBe(100)
        expect(tree.byName.get('iPhone')).toBe(10)
    })
})

describe('getSelectedCategoryPath', () => {
    it('joins selected categories\' names with " > " in level order', () => {
        const tree = buildCategoryTree(CATEGORIES)

        expect(getSelectedCategoryPath([1, 10, 100], tree)).toBe('Ремонт > iPhone > Замена экрана')
    })

    it('stops at the first unselected (null) level, ignoring anything after it', () => {
        const tree = buildCategoryTree(CATEGORIES)

        expect(getSelectedCategoryPath([1, null, 100], tree)).toBe('Ремонт')
    })

    it('returns an empty string when nothing is selected', () => {
        const tree = buildCategoryTree(CATEGORIES)

        expect(getSelectedCategoryPath([], tree)).toBe('')
        expect(getSelectedCategoryPath([null], tree)).toBe('')
    })
})
