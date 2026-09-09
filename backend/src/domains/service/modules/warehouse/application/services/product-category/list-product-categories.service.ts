import { Inject, Injectable } from '@nestjs/common';
import type { ListProductCategoriesResponse } from 'ireports-contracts';
import { PRODUCT_CATEGORY_REPOSITORY } from '@/domains/service/modules/warehouse/application/ports/product-category/product-category.port';
import type { ProductCategoryRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/product-category/product-category.port';
import { toProductCategoryResponse } from '@/domains/service/modules/warehouse/application/mappers/product-category/to-product-category-response';

// Read-side справочника категорий товаров (GET /v1/service/warehouse/
// product-categories, задача 10) — плоский список, вложенность
// восстанавливается вызывающей стороной (фронтенд, CategoryTreeSelect,
// задача 17) по parentId. По образцу ListOrderTypesService (modules/reports).
@Injectable()
export class ListProductCategoriesService {
    constructor(
        @Inject(PRODUCT_CATEGORY_REPOSITORY)
        private readonly repo: ProductCategoryRepositoryPort,
    ) {}

    async execute(): Promise<ListProductCategoriesResponse> {
        const categories = await this.repo.findAll();
        return categories.map(toProductCategoryResponse);
    }
}
