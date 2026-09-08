import { z } from 'zod';

// Дерево категорий каталога магазина (MoySkladProductFolder, Фаза 10
// domains/shop/sync/moySklad) — GET /shop/warehouse/catalog (модуль
// warehouse, сущность catalog, см.
// docs/shop-warehouse-catalog/prd-shop-warehouse-catalog.md). Только
// категории, без товаров/остатков ("Не в скоупе" PRD) — родитель/потомки,
// не плоский список.
export interface CatalogCategoryResponse {
    id: string;
    name: string;
    pathName: string;
    children: CatalogCategoryResponse[];
}

const catalogCategorySchema: z.ZodType<CatalogCategoryResponse> = z.lazy(() =>
    z.object({
        id: z.string(),
        name: z.string(),
        pathName: z.string(),
        children: z.array(catalogCategorySchema),
    }),
);

const catalogResponseSchema = z.array(catalogCategorySchema);
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

export { catalogCategorySchema, catalogResponseSchema };
