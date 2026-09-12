import { ServiceCategory } from '../value-objects/service-category.value-object';
import { resolveCategorySubtreeIds } from './category-subtree';

function category(id: number, parentId: number | null): ServiceCategory {
    return ServiceCategory.create({
        id,
        name: `Категория ${id}`,
        parentId,
        depth: 0,
    });
}

describe('resolveCategorySubtreeIds', () => {
    it('категория без подкатегорий даёт список из одного её id', () => {
        const categories = [category(1, null), category(2, null)];

        expect(resolveCategorySubtreeIds(categories, 1)).toEqual([1]);
    });

    it('раскрывает подкатегории на нескольких уровнях вложенности', () => {
        const categories = [
            category(1, null),
            category(2, 1),
            category(3, 1),
            category(4, 2),
            category(5, null),
        ];

        expect(resolveCategorySubtreeIds(categories, 1)).toEqual([1, 2, 3, 4]);
    });

    it('несуществующий id возвращает список из одного него самого', () => {
        const categories = [category(1, null)];

        expect(resolveCategorySubtreeIds(categories, 999)).toEqual([999]);
    });
});
