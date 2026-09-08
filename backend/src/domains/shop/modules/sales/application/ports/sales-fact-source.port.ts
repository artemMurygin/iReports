// Агрегированные по (отделу, категории) данные МойСклад за период — сырой
// вход для ShopSalesFact.calculate() (Фаза 11, зеркало
// ServiceSalesFactErpAggregate направления service). Отдаётся одним батчем
// на весь период (без N+1 по строкам плана), см. обоснование в
// infrastructure/repositories/moysklad-sales-fact-source.repository.ts.
//
// category — корневой MoySkladProductFolder.id (UUID, тот же формат, что и
// у SalesPlan.category после перехода на string, см. sales-plan.mapper.ts,
// NO_CATEGORY_ID) одной из категорий, переданных в aggregate(); позиции
// вложенных дочерних папок раскрываются до этого корня. `null` — позиции,
// не попавшие ни в одну из запрошенных категорий (в т.ч. когда categoryIds
// пуст — план без категории, поведение как раньше, Фаза 1
// docs/shop-sales-performance-by-category).
export interface ShopSalesFactErpAggregate {
    department: number;
    category: string | null;
    turnover: number;
    // ⚠️ Готовая маржа из MoySkladDemandPosition.profit — см.
    // ShopSalesFactCalculateInput.margin.
    margin: number;
    cost: number;
    // Float — сумма MoySkladDemandPosition.quantity (весовой/дробный товар).
    quantity: number;
}

export interface ShopSalesFactSourcePort {
    // categoryIds — корневые category/folderId, встречающиеся среди планов
    // запрошенного периода (Фаза 1 docs/shop-sales-performance-by-category);
    // реализация раскрывает каждый до потомков и агрегирует факт по паре
    // (department, rootCategoryId).
    aggregate(
        period: string,
        categoryIds: string[],
    ): Promise<ShopSalesFactErpAggregate[]>;
}

export const SHOP_SALES_FACT_SOURCE = Symbol('SHOP_SALES_FACT_SOURCE');
