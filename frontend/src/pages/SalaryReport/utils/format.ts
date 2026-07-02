const ruFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function money(v: number, allowNegative = false): string {
    if (!allowNegative) return `${ruFormatter.format(v)} ₽`
    const formatted = ruFormatter.format(Math.abs(v))
    return v < 0 ? `−${formatted} ₽` : `${formatted} ₽`
}
