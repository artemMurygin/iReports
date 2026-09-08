import type { ProductCategoryResponse } from 'ireports-contracts';
import { ProductCategory } from '@/domains/service/modules/warehouse/domain/value-objects/product-category.value-object';

export function toProductCategoryResponse(
    category: ProductCategory,
): ProductCategoryResponse {
    return {
        id: category.getId(),
        name: category.getName(),
        parentId: category.getParentId(),
    };
}
