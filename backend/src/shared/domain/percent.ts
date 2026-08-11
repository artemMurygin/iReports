// Процент `part` от `whole`, округлённый до сотых, без деления на 0 — общий
// помощник для SalesFact/SalesPrognose обоих направлений (service и shop,
// Фазы 5 и 11): marginPercent и percentCompletion в обоих модулях считаются
// этой же функцией, чтобы округление не расходилось между направлениями.
// Изначально жил только в service/modules/sales/domain/value-objects/
// sales-fact.value-object.ts, переехал сюда вместе с SalesPrognose.forPeriod()
// (см. sales-prognose.value-object.ts), как только формула понадобилась
// второму направлению — тот же принцип переезда, что и у Period (см.
// комментарий в period.value-object.ts).
export function percentOf(part: number, whole: number): number {
    if (!whole) {
        return 0;
    }
    return Math.round((part / whole) * 10000) / 100;
}
