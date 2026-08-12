import type { CalculationContext } from '@/shared/domain/calculation-context';

// Карта percentCompletion по категории — форма CalculationContext.salesPerformance
// для направления shop (Фаза 2 плана shop-sales-performance-by-category,
// закрывает issue #60). Ключ — ProductSoldSalaryConfig.category /
// UsedProductSoldSalaryConfig.category (id корневой папки
// MoySkladProductFolder — та же категория, что раскрывается до потомков в
// erpData.categoryDescendantFolderIds, см. shop-calculation-data.types.ts);
// null — «весь отдел» (правила без категории: TaskCompletedShopEntity с
// FloatPercent, у которого понятия категории нет вовсе, либо ProductSold/
// UsedProductSold с config.category === null). Одна мотивационная схема
// сотрудника может нести несколько правил ProductSold с РАЗНЫМИ
// категориями — каждому нужен факт именно своей категории, поэтому
// единственное значение SalesPerformanceContext общего CalculationContext
// (department + category + один percentCompletion) здесь не подходит.
// Категории, для которых расчёт не нашёлся (нет плана/факта по scope),
// в карте отсутствуют — правило само решает, что делать при отсутствующем
// ключе (fail closed, см. product-sold.entity.ts), а не читает null/undefined
// как валидный percentCompletion.
export type ShopSalesPerformanceByCategory = Map<string | null, number>;

// Зеркало общего CalculationContext (shared/domain/calculation-context.ts) с
// единственным отличием — salesPerformance несёт карту по категориям, а не
// одно значение на отдел. Общий CalculationContext намеренно НЕ трогаем: им
// продолжает пользоваться domains/service без изменений (см.
// backend/CLAUDE.md, domains/shop/CLAUDE.md — modules/accounting shop
// полностью независим от service по правилам домена, заводить общий
// generic-параметр ради одного направления не нужно). erpData здесь по-
// прежнему unknown, как и в общем типе — конкретные правила сами приводят
// его к ShopCalculationErpData (тот же приём, что уже применён во всех
// сущностях правил shop, см. product-sold.entity.ts).
export type ShopCalculationContext = Omit<
    CalculationContext,
    'salesPerformance'
> & {
    salesPerformance: ShopSalesPerformanceByCategory | null;
};
