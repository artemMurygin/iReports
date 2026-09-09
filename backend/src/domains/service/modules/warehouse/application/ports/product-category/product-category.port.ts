import { ProductCategory } from '@/domains/service/modules/warehouse/domain/value-objects/product-category.value-object';

// Read-порт над уже существующим справочником RoappProductCategory —
// без бизнес-инвариантов, никаких write-методов (справочник наполняется
// синком RoApp, не этим модулем).
export interface ProductCategoryRepositoryPort {
    // Полное дерево категорий плоским списком (иерархия — по parentId,
    // обход строит вызывающая сторона: BuildGoodsTurnoverReportService,
    // задача 9, и фронтенд, CategoryTreeSelect, задача 17).
    findAll(): Promise<ProductCategory[]>;
}

export const PRODUCT_CATEGORY_REPOSITORY = Symbol(
    'PRODUCT_CATEGORY_REPOSITORY',
);
