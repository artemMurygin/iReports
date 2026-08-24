export type DeltaTone = 'positive' | 'negative' | 'warning'

/**
 * Тон бейджа-дельты прогноза относительно факта в герое карточки-гроссбуха — общий для
 * `LedgerHero` (сотрудник) и `DepartmentLedgerHeroV2` (отдел): закрытый месяц -> `warning`
 * ("Месяц закрыт", `total.prognose` в этом случае гарантированно `null`), иначе — `positive` при
 * неотрицательной дельте прогноза к факту и `negative` при отрицательной.
 */
export function getDeltaTone(delta: number, isClosed: boolean): DeltaTone {
    if (isClosed) return 'warning'
    return delta < 0 ? 'negative' : 'positive'
}
