import { ListProductCategoriesService } from './list-product-categories.service';
import type { ProductCategoryRepositoryPort } from '../../ports/product-category/product-category.port';
import { ProductCategory } from '../../../domain/value-objects/product-category.value-object';

// По образцу list-order-types.service.spec.ts (modules/reports) — плоский
// read-only справочник без параметров.
describe('ListProductCategoriesService', () => {
    const buildService = (categories: ProductCategory[]) => {
        const findAll = jest
            .fn<Promise<ProductCategory[]>, []>()
            .mockResolvedValue(categories);
        const repo: ProductCategoryRepositoryPort = { findAll };

        return { service: new ListProductCategoriesService(repo), findAll };
    };

    it('возвращает пустой список, если справочник пуст', async () => {
        const { service } = buildService([]);

        const result = await service.execute();

        expect(result).toEqual([]);
    });

    it('маппит VO из порта в плоскую форму контракта', async () => {
        const { service } = buildService([
            ProductCategory.create({ id: 1, name: 'Запчасти', parentId: null }),
            ProductCategory.create({
                id: 2,
                name: 'Аккумуляторы',
                parentId: 1,
            }),
        ]);

        const result = await service.execute();

        expect(result).toEqual([
            { id: 1, name: 'Запчасти', parentId: null },
            { id: 2, name: 'Аккумуляторы', parentId: 1 },
        ]);
    });
});
