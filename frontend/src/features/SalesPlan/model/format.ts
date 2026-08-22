// Форматтеры периода/денег/процентов переехали в shared/lib/format.ts (Фаза 4
// docs/payroll-closing-and-accrual): они понадобились второй фиче —
// features/AccountingPeriod (диалог закрытия месяца), а кросс-импорты между
// features запрещены линтингом (см. frontend/CLAUDE.md). Реэкспорт сохраняет
// прежний публичный API этой фичи (`@/features/SalesPlan` — см. index.ts), которым
// уже пользуются pages/SalesPlan и pages/SalaryReport.
export {
    formatPeriodLabel,
    formatPeriodMonthName,
    isValidPeriod,
    shiftPeriod,
    formatNumber,
    formatCurrency,
    formatSignedCurrency,
    formatPercent,
    formatPercentPrecise,
} from '@/shared/lib/format.ts'

/** '1' -> 'категория', '2' -> 'категории', '5'/'11' -> 'категорий' (Russian plural rules).
 * Остался здесь (не в shared): используется только подписями KPI-карточек плана продаж. */
export function pluralizeCategories(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100

    if (mod10 === 1 && mod100 !== 11) return 'категория'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'категории'
    return 'категорий'
}
