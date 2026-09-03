import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SalesDirection, UpdateSalesPlanOrderRequest } from 'ireports-contracts'

import { api } from './api.ts'

/**
 * Mirrors `useUpdateSalesPlanRows.ts` (same file, same invalidation key, same
 * direction-picks-the-endpoint shape) but PATCHes the batch order endpoint from Фаза 1/Фаза 4
 * (`docs/sales-plan-row-drag-and-drop-reorder`, `PATCH .../sales/plan/order`) instead of one
 * PATCH per changed row — the whole new order for a department is a single request, not one per
 * category, so there's no per-item try/catch wrapping here: a failure rejects the mutation as
 * usual and `useEditPlanForm.handleSave` (run alongside `useUpdateSalesPlanRows` via
 * `Promise.allSettled`, both as one "Сохранить" action) is what decides how a rejection is
 * surfaced/keeps the modal open.
 */
export function useUpdateSalesPlanOrder(direction: SalesDirection) {
    const queryClient = useQueryClient()
    const updateOrder = direction === 'shop' ? api.updateShopSalesPlanOrder : api.updateSalesPlanOrder

    return useMutation({
        mutationFn: (payload: UpdateSalesPlanOrderRequest) => updateOrder(payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['sales-plan', 'sales-performance', direction] })
        },
    })
}
