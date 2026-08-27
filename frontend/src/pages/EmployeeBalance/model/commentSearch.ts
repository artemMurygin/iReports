import type { BalanceTransaction } from 'ireports-contracts'

/**
 * Поиск по комментарию (Pencil `L73YCK`/`JTc29`, docs/employee-settlements-page-redesign, Фаза
 * 5) — регистронезависимая подстрока по `comment`, применяется НА КЛИЕНТЕ: `GetEmployeeBalanceQuery`
 * (contracts/commands/employee-balance.ts) фильтрует только по `from`/`to`/`types`, поискового
 * параметра по комментарию у эндпоинта нет (это фильтр ленты страницы, а не сводки
 * взаиморасчётов — там поиск по имени идёт на бэкенд, см. `GetBalanceSummaryService`). Движение
 * без комментария (`comment: null`) никогда не совпадает с непустым поиском.
 *
 * ОГРАНИЧЕНИЕ (Фаза 8, сознательно, а не баг): с курсорной пагинацией ленты (`useInfiniteQuery`,
 * `useEmployeeBalancePage`) этот фильтр применяется только к уже ЗАГРУЖЕННЫМ страницам, а не ко
 * всей истории движений сотрудника за всё время — движение с совпадающим комментарием, которое
 * ещё не подгружено (пользователь не долистал до него), в результатах поиска не появится, пока
 * страница с ним не будет загружена. Расширить поиск на всю историю можно только добавив
 * серверный параметр в контракт — вне рамок этой фазы (см. план, Фаза 8, пункт про поиск по
 * комментарию).
 */
export function matchesCommentSearch(transaction: Pick<BalanceTransaction, 'comment'>, search: string): boolean {
    const query = search.trim().toLowerCase()
    if (query === '') return true
    return (transaction.comment ?? '').toLowerCase().includes(query)
}
