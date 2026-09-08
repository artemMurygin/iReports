import type { CatalogCategoryResponse } from 'ireports-contracts';
import { CategoryNode } from '../../domain/value-objects/category-node.value-object';

export function toCatalogResponse(
    nodes: CategoryNode[],
): CatalogCategoryResponse[] {
    return nodes.map((node) => ({
        id: node.getId(),
        name: node.getName(),
        pathName: node.getPathName(),
        children: toCatalogResponse(node.getChildren()),
    }));
}
