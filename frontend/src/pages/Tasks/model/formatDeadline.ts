/** Same `ru-RU` day/month/year format as `features/TaskStatusControl/ui/TaskStatusCard.tsx`'s
 * local `formatDeadline` — duplicated here rather than imported (that helper isn't part of the
 * feature's public `index.ts`, and features/pages don't reach into each other's `ui`/`model`).
 *
 * `Task.deadline` is typed as `Date` in `ireports-contracts` (the response schema uses
 * `z.coerce.date()`), but the frontend reads API responses as raw JSON without running them
 * through that schema — over the wire it's an ISO date string, not a `Date` instance (same as
 * `EmployeeBalance`'s `transaction.occurredAt`, see `TransactionsLedger.tsx`). Wrap in `new Date(...)`
 * rather than trust the declared type. */
export function formatDeadline(deadline: Date | string): string {
    return new Date(deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
