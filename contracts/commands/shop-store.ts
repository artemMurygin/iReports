import { z } from 'zod';

// Справочник складов МойСклад (MoySkladStore) — GET /v1/shop/warehouse/
// stores, вспомогательный список для фильтра склада на странице отчёта по
// оборачиваемости (см. openspec/changes/shop-turnover-report/
// {design,architecture}.md, D10) и по образцу CatalogResponse
// (contracts/commands/catalog.ts) для дерева категорий того же модуля.
const shopStoreSchema = z.object({
    id: z.string(),
    name: z.string(),
});
export type ShopStore = z.infer<typeof shopStoreSchema>;

const shopStoresResponseSchema = z.array(shopStoreSchema);
export type ShopStoresResponse = z.infer<typeof shopStoresResponseSchema>;

export { shopStoreSchema, shopStoresResponseSchema };
