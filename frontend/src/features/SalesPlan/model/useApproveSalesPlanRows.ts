import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApproveSalesPlanRequest, SalesDirection, SalesPlanResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/** Bitrix24 employee id passed as `approvedBy` — hardcoded by explicit user decision, there is no
 * "current user" concept on the frontend (no auth/session model, see backend/CLAUDE.md on
 * PortalAdminGuard) to resolve it from. Same design as `approvedBy` in
 * `approveSalesPlanRequestSchema` (contracts/commands/sales-plan.ts): the backend accepts it as a
 * plain field in the request body rather than deriving it server-side. */
const HARDCODED_APPROVED_BY = 1

/**
 * POST `/v1/service/sales/plan/approve` / `/v1/shop/sales/plan/approve` — the `{ ids, approvedBy }`
 * variant of `approveSalesPlanRequestSchema` (row-level approval, not the whole-period `{ period,
 * approvedBy }` variant — this mutation only ever approves the rows the Selection Bar has
 * checked). Same shape as `useUpdateSalesPlanRows`: one `direction`-scoped mutation, plain axios
 * call wrapped in `ApiError` inside the mutation itself (not per-row try/catch — unlike the PATCH
 * batch, `approve` is already a single batched request, so a failure fails the whole call and
 * there's nothing partial to reconcile).
 *
 * Invalidates `salesPerformance` for this `direction` on success so the table/card list picks up
 * the new `APPROVED` status immediately (same `['sales-plan', 'sales-performance', direction]`
 * queryKey prefix as the update mutation, see `model/api.ts`).
 */
export function useApproveSalesPlanRows(direction: SalesDirection) {
    const queryClient = useQueryClient()
    const path = direction === 'shop' ? '/v1/shop/sales/plan/approve' : '/v1/service/sales/plan/approve'

    return useMutation({
        mutationFn: (ids: string[]): Promise<SalesPlanResponse[]> => {
            const payload: ApproveSalesPlanRequest = { ids, approvedBy: HARDCODED_APPROVED_BY }
            return apiInstance
                .post<SalesPlanResponse[]>(path, payload)
                .then((r) => r.data)
                .catch((error) => {
                    throw new ApiError('Не удалось утвердить план продаж ' + error)
                })
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['sales-plan', 'sales-performance', direction] })
        },
    })
}

export { HARDCODED_APPROVED_BY }
