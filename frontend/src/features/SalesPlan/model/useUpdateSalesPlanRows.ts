import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SalesDirection, UpdateSalesPlanRequest } from 'ireports-contracts'

import { api } from './api.ts'

/** One changed row headed to `PATCH .../sales/plan/:id` — `categoryName` rides along only so a
 * failed result can name the row in the error toast, it isn't sent in the request body. */
export type PlanRowUpdate = { id: string; categoryName: string } & UpdateSalesPlanRequest

export type PlanRowUpdateResult =
    | { id: string; categoryName: string; ok: true }
    | { id: string; categoryName: string; ok: false; error: string }

/**
 * Batch-PATCHes a set of changed `SalesPlan` rows for one `direction` in parallel. Requested as
 * "`Promise.all` для параллельной отправки" (see the task), but a naive `Promise.all` over the
 * raw PATCH calls would reject on the first failure and hide which of the other rows succeeded
 * or failed — so each request is wrapped in its own try/catch first (turning a rejection into a
 * resolved `{ ok: false }` entry), and `Promise.all` runs over those wrapped promises instead.
 * That keeps the "send everything in parallel via `Promise.all`" request while still surfacing
 * a per-row result to `EditPlanModal`, which needs to know exactly which categories failed so
 * the user can retry only what didn't save (see its "не закрывай модалку" requirement).
 *
 * Invalidates `salesPerformance` for this `direction` (both periods it could be keyed under,
 * via the shared `['sales-plan', 'sales-performance', direction]` prefix — see `model/api.ts`)
 * whenever at least one row succeeded, even on a partial failure: the rows that did save should
 * stop showing their pre-edit values/status on the page underneath immediately, independent of
 * whether the modal itself stays open for a retry.
 */
export function useUpdateSalesPlanRows(direction: SalesDirection) {
    const queryClient = useQueryClient()
    const updateRow = direction === 'shop' ? api.updateShopSalesPlan : api.updateSalesPlan

    return useMutation({
        mutationFn: async (updates: PlanRowUpdate[]): Promise<PlanRowUpdateResult[]> =>
            Promise.all(
                updates.map(async ({ id, categoryName, ...payload }): Promise<PlanRowUpdateResult> => {
                    try {
                        await updateRow(id, payload)
                        return { id, categoryName, ok: true }
                    } catch (error) {
                        return { id, categoryName, ok: false, error: error instanceof Error ? error.message : String(error) }
                    }
                }),
            ),
        onSuccess: (results) => {
            if (results.some((result) => result.ok)) {
                void queryClient.invalidateQueries({ queryKey: ['sales-plan', 'sales-performance', direction] })
            }
        },
    })
}
