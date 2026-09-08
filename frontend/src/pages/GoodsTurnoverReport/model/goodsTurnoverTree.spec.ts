import { describe, expect, it } from 'vitest'

import {
    buildGoodsTurnoverTreeRows,
    getRatioColorClass,
    getRootDotColor,
    pluralizeCategories,
    summarizeGoodsTurnoverRows,
    type GoodsTurnoverRow,
} from './goodsTurnoverTree.ts'

// TDD задачи 18.2-18.3 (openspec/changes/service-turnover-report): построение дерева строк
// `GoodsTurnoverTable` из плоского `GoodsTurnoverRow[]` + `categoryParentId` — вложенность
// произвольной глубины, число `Rail` (= `depth`) равно глубине узла, нулевая категория остаётся
// обычной строкой с `turnoverRatio: null` (рендер "—" — ответственность UI-слоя, здесь только
// проверяем, что значение не отфильтровано/не искажено).

function row(overrides: Partial<GoodsTurnoverRow> & Pick<GoodsTurnoverRow, 'categoryId' | 'categoryParentId'>): GoodsTurnoverRow {
    return {
        categoryName: `Категория ${overrides.categoryId}`,
        warehouseId: 1,
        warehouseName: 'Склад',
        outcomeQuantity: 0,
        outcomeSum: 0,
        stockQuantity: 0,
        stockSum: 0,
        turnoverRatio: null,
        ...overrides,
    }
}

describe('buildGoodsTurnoverTreeRows', () => {
    it('returns an empty list for an empty input', () => {
        expect(buildGoodsTurnoverTreeRows([])).toEqual([])
    })

    it('places a category without a parent at depth 0 with no children', () => {
        const rows = [row({ categoryId: 1, categoryParentId: null })]

        const tree = buildGoodsTurnoverTreeRows(rows)

        expect(tree).toHaveLength(1)
        expect(tree[0]).toMatchObject({ categoryId: 1, depth: 0, hasChildren: false })
    })

    it('marks a parent row as hasChildren and nests its child at depth 1', () => {
        const rows = [row({ categoryId: 1, categoryParentId: null }), row({ categoryId: 2, categoryParentId: 1 })]

        const tree = buildGoodsTurnoverTreeRows(rows)

        expect(tree.map((r) => [r.categoryId, r.depth, r.hasChildren])).toEqual([
            [1, 0, true],
            [2, 1, false],
        ])
    })

    it('supports arbitrary nesting depth — depth equals the number of Rail frames (5 levels)', () => {
        const rows = [
            row({ categoryId: 1, categoryParentId: null }),
            row({ categoryId: 2, categoryParentId: 1 }),
            row({ categoryId: 3, categoryParentId: 2 }),
            row({ categoryId: 4, categoryParentId: 3 }),
            row({ categoryId: 5, categoryParentId: 4 }),
        ]

        const tree = buildGoodsTurnoverTreeRows(rows)

        expect(tree.map((r) => r.depth)).toEqual([0, 1, 2, 3, 4])
        expect(tree.map((r) => r.hasChildren)).toEqual([true, true, true, true, false])
    })

    it('groups children under the right parent even when siblings are interleaved in the input', () => {
        const rows = [
            row({ categoryId: 1, categoryParentId: null }),
            row({ categoryId: 10, categoryParentId: null }),
            row({ categoryId: 11, categoryParentId: 10 }),
            row({ categoryId: 2, categoryParentId: 1 }),
        ]

        const tree = buildGoodsTurnoverTreeRows(rows)

        expect(tree.map((r) => [r.categoryId, r.depth])).toEqual([
            [1, 0],
            [2, 1],
            [10, 0],
            [11, 1],
        ])
    })

    it('keeps a category without movement as a regular row with turnoverRatio null, not filtered out', () => {
        const rows = [row({ categoryId: 1, categoryParentId: null, outcomeQuantity: 0, outcomeSum: 0, turnoverRatio: null })]

        const tree = buildGoodsTurnoverTreeRows(rows)

        expect(tree).toHaveLength(1)
        expect(tree[0].turnoverRatio).toBeNull()
    })

    it('treats a row whose parentId points outside the given set as a root, instead of dropping it', () => {
        const rows = [row({ categoryId: 2, categoryParentId: 999 })]

        const tree = buildGoodsTurnoverTreeRows(rows)

        expect(tree).toHaveLength(1)
        expect(tree[0]).toMatchObject({ categoryId: 2, depth: 0 })
    })

    it('assigns each root category its own incrementing rootIndex, shared by its whole subtree', () => {
        const rows = [
            row({ categoryId: 1, categoryParentId: null }),
            row({ categoryId: 2, categoryParentId: 1 }),
            row({ categoryId: 3, categoryParentId: 2 }),
            row({ categoryId: 20, categoryParentId: null }),
        ]

        const tree = buildGoodsTurnoverTreeRows(rows)

        expect(tree.map((r) => [r.categoryId, r.rootIndex])).toEqual([
            [1, 0],
            [2, 0],
            [3, 0],
            [20, 1],
        ])
    })
})

describe('getRootDotColor', () => {
    it('cycles through a fixed 6-color palette by rootIndex', () => {
        const colors = [0, 1, 2, 3, 4, 5, 6, 7].map(getRootDotColor)
        expect(colors[0]).toBe(colors[6])
        expect(colors[1]).toBe(colors[7])
        expect(new Set(colors.slice(0, 6)).size).toBe(6)
    })
})

describe('getRatioColorClass', () => {
    it('returns a distinct class for null, low, normal and high ratios', () => {
        expect(getRatioColorClass(null)).toBe('text-ink-faint')
        expect(getRatioColorClass(0.5)).toBe('text-danger')
        expect(getRatioColorClass(0.7)).toBe('text-warn-ink')
        expect(getRatioColorClass(0.9)).toBe('text-ink')
        expect(getRatioColorClass(1.5)).toBe('text-ok-ink')
    })
})

describe('summarizeGoodsTurnoverRows', () => {
    it('sums outcome/stock over root categories only, not the nested rollup rows', () => {
        const rows = [
            row({ categoryId: 1, categoryParentId: null, outcomeSum: 100, stockSum: 200, stockQuantity: 4 }),
            row({ categoryId: 2, categoryParentId: 1, outcomeSum: 60, stockSum: 120, stockQuantity: 2 }),
            row({ categoryId: 3, categoryParentId: 1, outcomeSum: 40, stockSum: 80, stockQuantity: 2 }),
        ]

        const summary = summarizeGoodsTurnoverRows(rows)

        expect(summary.outcomeSum).toBe(100)
        expect(summary.stockSum).toBe(200)
        expect(summary.stockQuantity).toBe(4)
        expect(summary.rootCategoriesCount).toBe(1)
    })

    it('returns turnoverRatio null when no root row has a computed ratio', () => {
        const rows = [row({ categoryId: 1, categoryParentId: null, turnoverRatio: null })]

        expect(summarizeGoodsTurnoverRows(rows).turnoverRatio).toBeNull()
    })

    it('weighs the aggregate ratio by stockSum across root rows with a computed ratio', () => {
        const rows = [
            row({ categoryId: 1, categoryParentId: null, stockSum: 100, turnoverRatio: 1 }),
            row({ categoryId: 2, categoryParentId: null, stockSum: 300, turnoverRatio: 2 }),
        ]

        expect(summarizeGoodsTurnoverRows(rows).turnoverRatio).toBeCloseTo(1.75)
    })

    it('treats an empty input as zero totals with a null ratio', () => {
        const summary = summarizeGoodsTurnoverRows([])
        expect(summary).toEqual({ outcomeSum: 0, stockSum: 0, stockQuantity: 0, turnoverRatio: null, rootCategoriesCount: 0 })
    })
})

describe('pluralizeCategories', () => {
    it('picks the right Russian plural form', () => {
        expect(pluralizeCategories(1)).toBe('категория')
        expect(pluralizeCategories(2)).toBe('категории')
        expect(pluralizeCategories(5)).toBe('категорий')
        expect(pluralizeCategories(11)).toBe('категорий')
        expect(pluralizeCategories(21)).toBe('категория')
    })
})
