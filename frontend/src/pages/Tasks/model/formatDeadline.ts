/** Same `ru-RU` day/month/year format as `features/TaskStatusControl/ui/TaskStatusCard.tsx`'s
 * local `formatDeadline` — duplicated here rather than imported (that helper isn't part of the
 * feature's public `index.ts`, and features/pages don't reach into each other's `ui`/`model`). */
export function formatDeadline(deadline: Date): string {
    return deadline.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
