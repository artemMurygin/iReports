/** Компактная сумма в рублях — "12 300 ₽" / "1.4 млн ₽". Перенесено из старой `ServicesTable.tsx`
 * без изменений: это чистое форматирование, а не бизнес-логика. */
export function fmtMoney(n: number): string {
    if (n >= 1_000_000) {
        const v = n / 1_000_000
        return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} млн ₽`
    }
    return n.toLocaleString('ru-RU') + ' ₽'
}

/** Цвет колонки "Прибыль" по знаку — на новых токенах (`text-ok-ink`/`text-danger`/`text-ink-faint`)
 * вместо старых `emerald-700`/`red-600`/`gray-400`. */
export function profitColorClass(profit: number): string {
    if (profit > 0) return 'text-ok-ink'
    if (profit < 0) return 'text-danger'
    return 'text-ink-faint'
}

/** Ширина полоски "Продажи"/mobile-прогресса, в процентах от лидера — тот же расчёт, что и в
 * старой `ServicesTable.tsx`, вынесен сюда, чтобы не дублировать между десктоп-таблицей и
 * мобильной карточкой. */
export function barWidthPercent(count: number, maxCount: number): number {
    return maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
}
