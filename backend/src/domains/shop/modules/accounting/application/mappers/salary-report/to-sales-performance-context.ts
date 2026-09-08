import type { SalaryCalculationMode } from '@/shared/domain/calculation-context';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/sales-performance.value-object';
import type { ShopSalesPerformanceByCategory } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';

// Зеркало domains/service/modules/accounting/application/mappers/to-sales-performance-context.ts
// (Фаза 13.5, issue #57) — независимая реализация для направления shop. С
// Фазы 2 плана shop-sales-performance-by-category вход — не единственный
// ShopSalesPerformance подразделения, а карта по категориям правил
// ProductSold/UsedProductSold схемы сотрудника (ключ null — «весь отдел»,
// см. BuildShopCalculationContextService.findSalesPerformance) — на выходе
// та же карта, но со значением percentCompletion вместо целого агрегата
// (см. calculation-context.types.ts).
//
// Режим расчёта FACT | PROGNOSE в контексте (см. комментарий у service-
// версии): в режиме PROGNOSE правило получает
// ShopSalesPerformance.getPrognose().getPercentCompletion() вместо
// ShopSalesFact.getPercentCompletion() на вход вместо фактического
// процента выполнения плана — единственное отличие между двумя проходами
// calculate(). erpData в обоих режимах общий — эта функция трогает только
// проценты выполнения плана по категориям.
export function toShopSalesPerformanceContext(
    performanceByCategory: ReadonlyMap<string | null, ShopSalesPerformance>,
    mode: SalaryCalculationMode,
): ShopSalesPerformanceByCategory | null {
    if (performanceByCategory.size === 0) {
        return null;
    }
    const result: ShopSalesPerformanceByCategory = new Map();
    for (const [category, performance] of performanceByCategory) {
        const percentCompletion =
            mode === 'PROGNOSE'
                ? performance.getPrognose().getPercentCompletion()
                : performance.getFact().getPercentCompletion();
        result.set(category, percentCompletion);
    }
    return result;
}
