import { ShopSalesPerformance } from '../../domain/value-objects/sales-performance.value-object';

// Единственный вход в ShopSalesPerformance для остальных модулей домена shop
// (Фаза 11, зеркало SalesPerformanceReaderPort направления service) — в
// частности, для будущего domains/shop/modules/accounting (Фаза 12).
// В отличие от service-порта, без параметра direction: этот порт живёт в
// домене shop и обслуживает только направление shop, поэтому направление
// не параметр, а данность контекста — исключает саму возможность случайно
// вызвать его не с тем направлением (см. SalesPerformanceDirectionNotSupportedException
// у service-порта, которая существует именно из-за того, что там direction
// — параметр интерфейса, а не свойство модуля).
export interface ShopSalesPerformanceReaderPort {
    // Все строки ShopSalesPerformance периода — вход эндпоинта
    // GET /shop/sales/salesPerformance/:period.
    listForPeriod(period: string): Promise<ShopSalesPerformance[]>;

    // Одна строка по отделу и, опционально, категории — вход
    // CalculationContext.salesPerformance зарплатного расчёта шаблона shop
    // (Фаза 12). null, если для этой комбинации нет строки плана.
    findForScope(
        period: string,
        department: number,
        category: string | null,
    ): Promise<ShopSalesPerformance | null>;

    // Все строки ShopSalesPerformance ОДНОГО отдела за период — по каждой
    // заведённой категории, включая "весь отдел" (category: null), если
    // такая строка плана есть. Вход для построчной разбивки плана-продаж по
    // категориям в отчёте по зарплате (см.
    // GetShopEmployeeSalaryReportService.buildSalesPerformanceSummaries) —
    // иначе карточка плана продаж никогда не показывала бы категории для
    // отделов, ведущих план по категориям, а не одной строкой на отдел
    // целиком.
    listForDepartment(
        period: string,
        department: number,
    ): Promise<ShopSalesPerformance[]>;
}

export const SHOP_SALES_PERFORMANCE_READER = Symbol(
    'SHOP_SALES_PERFORMANCE_READER',
);
