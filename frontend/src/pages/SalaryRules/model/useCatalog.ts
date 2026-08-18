import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/** `GET /v1/shop/warehouse/catalog` (Фаза 4) — the category tree `CategoryCombobox.tsx` renders,
 * needed only by `ProductSold`/`UsedProductSold` shop rules. */
export function useCatalog() {
    return useQuery(api.getCatalog())
}
