// Агрегированные по (отделу, типу заказа) данные RemOnline (RoApp) за
// период — сырой вход для SalesFact.calculate() (Фаза 5) и для фильтра по
// SalesPlan.orderTypeIds (см. GetSalesPerformanceService.listForPeriod,
// docs/service-plan-salary-rule-order-category-filter). Отдаётся одним
// батчем на весь период, а не по одной строке плана за раз — иначе расчёт
// SalesPerformance по всем отделам месяца порождал бы N+1 (см. правило
// "расчёт отдела не порождает N+1" из соседних фаз плана).
//
// category здесь всегда null: у RoApp/RemOnline нет понятия категории на
// уровне заказа (RoappOrder не хранит категорию), поэтому сервис
// агрегирует факт только по отделу и типу заказа — см. комментарий у
// реализации порта
// (infrastructure/repositories/roapp-sales-fact-source.repository.ts) с
// подробным обоснованием. orderTypeId — RoappOrderType.id заказов этого
// бакета (RoappOrder.orderTypeId обязателен в схеме, поэтому всегда
// заполнен); используется для фильтрации бакетов отдела по
// SalesPlan.orderTypeIds на стороне GetSalesPerformanceService.
export interface ServiceSalesFactErpAggregate {
    department: number;
    orderTypeId: number;
    category: string | null;
    turnover: number;
    cost: number;
    quantity: number;
}

export interface ServiceSalesFactSourcePort {
    aggregate(period: string): Promise<ServiceSalesFactErpAggregate[]>;
}

export const SERVICE_SALES_FACT_SOURCE = Symbol('SERVICE_SALES_FACT_SOURCE');
