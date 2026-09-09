import { ProductCategory } from '../value-objects/product-category.value-object';
import { calculateCategoryDepths } from './category-depth.calculator';

function buildCategory(id: number, parentId: number | null = null) {
    return ProductCategory.create({ id, name: `Категория ${id}`, parentId });
}

describe('calculateCategoryDepths', () => {
    it('плоский список без parentId — все глубины 0', () => {
        const depths = calculateCategoryDepths([
            buildCategory(1),
            buildCategory(2),
        ]);

        expect(depths.get(1)).toBe(0);
        expect(depths.get(2)).toBe(0);
    });

    it('цепочка из нескольких уровней — глубина растёт с каждым уровнем', () => {
        const depths = calculateCategoryDepths([
            buildCategory(1),
            buildCategory(2, 1),
            buildCategory(3, 2),
        ]);

        expect(depths.get(1)).toBe(0);
        expect(depths.get(2)).toBe(1);
        expect(depths.get(3)).toBe(2);
    });

    it('parentId ссылается на категорию, отсутствующую в наборе — подъём останавливается на обрыве', () => {
        const depths = calculateCategoryDepths([buildCategory(2, 999)]);

        expect(depths.get(2)).toBe(0);
    });

    it('пустой список — пустая карта', () => {
        expect(calculateCategoryDepths([]).size).toBe(0);
    });
});
