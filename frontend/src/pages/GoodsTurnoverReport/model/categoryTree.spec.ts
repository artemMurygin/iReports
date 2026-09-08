import { describe, expect, it } from 'vitest'
import type { ListProductCategoriesResponse } from 'ireports-contracts'

import { getDirectChildren, resolveDescendantIds, searchCategories } from './categoryTree.ts'

// TDD задачи 17.2-17.3 (openspec/changes/service-turnover-report): адаптация
// `pages/ServicesReport/model/categoryTree.ts` под справочник товарных категорий
// (`GET /v1/service/warehouse/product-categories`, `ProductCategoryResponse` — плоский `{id, name,
// parentId}`, числовые id, без `depth` — в отличие от `ServiceCategory`). Дерево здесь двухуровневое:
// корень «Дисплеи» -> «iPhone» -> «iPhone 15».
const CATEGORIES: ListProductCategoriesResponse = [
    { id: 1, name: 'Дисплеи', parentId: null },
    { id: 2, name: 'iPhone', parentId: 1 },
    { id: 3, name: 'iPhone 15', parentId: 2 },
    { id: 4, name: 'Аккумуляторы', parentId: null },
]

describe('getDirectChildren', () => {
    it('возвращает корневые категории для parentId=null', () => {
        expect(getDirectChildren(CATEGORIES, null)).toEqual([CATEGORIES[0], CATEGORIES[3]])
    })

    it('возвращает прямых потомков переданной категории', () => {
        expect(getDirectChildren(CATEGORIES, 1)).toEqual([CATEGORIES[1]])
    })

    it('возвращает пустой список для категории без потомков', () => {
        expect(getDirectChildren(CATEGORIES, 3)).toEqual([])
    })
})

describe('resolveDescendantIds', () => {
    it('включает саму категорию и всех вложенных потомков произвольной глубины', () => {
        expect(resolveDescendantIds(CATEGORIES, 1)).toEqual([1, 2, 3])
    })

    it('для листовой категории возвращает только её id', () => {
        expect(resolveDescendantIds(CATEGORIES, 3)).toEqual([3])
    })
})

describe('searchCategories', () => {
    it('пустой запрос возвращает пустой список (вызывающий код показывает дерево, а не результаты поиска)', () => {
        expect(searchCategories(CATEGORIES, '')).toEqual([])
        expect(searchCategories(CATEGORIES, '   ')).toEqual([])
    })

    it('находит категории по подстроке в названии без учёта регистра', () => {
        const results = searchCategories(CATEGORIES, 'iphone')
        expect(results.map((r) => r.category.id)).toEqual([2, 3])
    })

    it('каждый результат несёт цепочку предков от корня для хлебной крошки', () => {
        const [match] = searchCategories(CATEGORIES, 'iPhone 15')
        expect(match.category.id).toBe(3)
        expect(match.ancestors.map((a) => a.id)).toEqual([1, 2])
    })

    it('корневая категория без предков — пустая цепочка ancestors', () => {
        const [match] = searchCategories(CATEGORIES, 'Аккумуляторы')
        expect(match.ancestors).toEqual([])
    })
})
