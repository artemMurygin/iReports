// Агрегированные по отделу данные МойСклад за период — сырой вход для
// ShopSalesFact.calculate() (Фаза 11, зеркало ServiceSalesFactErpAggregate
// направления service). Отдаётся одним батчем на весь период (без N+1 по
// строкам плана), см. обоснование в infrastructure/repositories/
// moysklad-sales-fact-source.repository.ts.
//
// category здесь всегда null — как и у service, категория для агрегата
// SalesFact не определена: SalesPlan.category — сентинел-совместимый Int
// (см. sales-plan.mapper.ts, NO_CATEGORY_ID), а у МойСклад нет Int-
// идентификатора категории — MoySkladProductFolder.id строковый (UUID),
// несовместимый по типу. Строки плана с непустой категорией получают
// нулевой факт — та же осознанная граница, что и у service (см.
// domains/service/modules/sales/application/ports/service-sales-fact-source.port.ts).
export interface ShopSalesFactErpAggregate {
    department: number;
    category: number | null;
    turnover: number;
    // ⚠️ Готовая маржа из MoySkladDemandPosition.profit — см.
    // ShopSalesFactCalculateInput.margin.
    margin: number;
    cost: number;
    // Float — сумма MoySkladDemandPosition.quantity (весовой/дробный товар).
    quantity: number;
}

export interface ShopSalesFactSourcePort {
    aggregate(period: string): Promise<ShopSalesFactErpAggregate[]>;
}

export const SHOP_SALES_FACT_SOURCE = Symbol('SHOP_SALES_FACT_SOURCE');
