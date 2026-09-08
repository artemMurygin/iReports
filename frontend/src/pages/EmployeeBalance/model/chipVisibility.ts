/**
 * Сворачивание лишних чипов типа движения на мобильной раскладке («Ещё N», Pencil `JTc29`,
 * docs/employee-settlements-page-redesign, Фаза 5): показываем первые `visibleCount` чипов
 * (порядок — как в `balanceTransactionTypeSchema`, contracts/commands/employee-balance.ts, тот
 * же, что уже использует десктопная раскладка `BalanceFilters`), а остаток сворачиваем за
 * кнопку «Ещё N». Десктоп чипы не сворачивает (переносит строкой, `flex-wrap`) — эта функция
 * нужна только мобильному варианту фильтров.
 */
export type ChipVisibility<T> = {
    visible: T[]
    hidden: T[]
}

export function splitVisibleChips<T>(items: readonly T[], visibleCount: number): ChipVisibility<T> {
    if (visibleCount < 0) throw new Error('visibleCount не может быть отрицательным')
    return {
        visible: items.slice(0, visibleCount),
        hidden: items.slice(visibleCount),
    }
}
