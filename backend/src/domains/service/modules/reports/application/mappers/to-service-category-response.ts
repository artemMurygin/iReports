import type { ServiceCategoryResponse } from 'ireports-contracts';
import { ServiceCategory } from '../../domain/value-objects/service-category.value-object';

// VO → плоская форма контракта, по образцу to-deal-list-item-response.ts —
// читает значения через геттеры VO, ничего не вычисляет.
export function toServiceCategoryResponse(
    category: ServiceCategory,
): ServiceCategoryResponse {
    return {
        id: category.getId(),
        name: category.getName(),
        parentId: category.getParentId(),
        depth: category.getDepth(),
    };
}
