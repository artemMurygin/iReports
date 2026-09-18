// Категории, полностью исключаемые из отчёта по оборачиваемости магазина —
// список id категорий MoySkladProductFolder через запятую в
// SHOP_GOODS_TURNOVER_EXCLUDED_CATEGORY_IDS. Нужно для категорий, не
// относящихся к реальному товарообороту магазина (например, категория
// "Игровые Ноутбуки Александр" внутри "Я.ИСКЛЮЧЕНИЕ" — сторонние позиции в
// общем справочнике МойСклад). Исключение раскрывается до всех потомков
// категории (см. RebuildGoodsTurnoverReportService) — товары исключённой
// категории и её подкатегорий не участвуют ни в собственной строке отчёта,
// ни в рулапе показателей родительских категорий.
export const GOODS_TURNOVER_EXCLUDED_CATEGORY_IDS = Symbol(
    'GOODS_TURNOVER_EXCLUDED_CATEGORY_IDS',
);

export const goodsTurnoverReportConfig = {
    excludedCategoryIds: (
        process.env.SHOP_GOODS_TURNOVER_EXCLUDED_CATEGORY_IDS ?? ''
    )
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
};
