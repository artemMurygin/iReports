import { ProductCategory } from '../value-objects/product-category.value-object';

// Глубина категории в дереве (0 — корень, 1 — прямой ребёнок корня, и т.д.),
// посчитанная по цепочке parentId внутри переданного набора категорий —
// вынесено из disposable scripts/recalcGoodsTurnoverOnce.ts
// (DepthLimitedProductCategoryRepository.depthOf) в постоянный код, см.
// GoodsTurnoverWarehouseScope. Если у категории есть parentId, но
// соответствующей записи нет среди переданных categories (обрыв цепочки),
// подъём останавливается на этом месте — глубина не досчитывается до
// формального корня.
export function calculateCategoryDepths(
    categories: ProductCategory[],
): Map<number, number> {
    const byId = new Map(categories.map((category) => [category.getId(), category]));
    const depths = new Map<number, number>();

    const depthOf = (category: ProductCategory): number => {
        const cached = depths.get(category.getId());
        if (cached !== undefined) {
            return cached;
        }

        let depth = 0;
        let current = category;
        while (current.getParentId() !== null) {
            const parent = byId.get(current.getParentId() as number);
            if (!parent) break;
            depth++;
            current = parent;
        }

        depths.set(category.getId(), depth);
        return depth;
    };

    for (const category of categories) {
        depthOf(category);
    }

    return depths;
}
