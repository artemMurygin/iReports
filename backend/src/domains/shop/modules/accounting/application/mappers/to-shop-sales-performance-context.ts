import type {
    SalaryCalculationMode,
    SalesPerformanceContext,
} from '@/shared/domain/calculation-context';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/shop-sales-performance.value-object';

// Зеркало domains/service/modules/accounting/application/mappers/to-sales-performance-context.ts
// (Фаза 13.5, issue #57) — независимая реализация для направления shop.
// Режим расчёта FACT | PROGNOSE в контексте (см. комментарий у service-
// версии): в режиме PROGNOSE правило получает
// ShopSalesPerformance.getPrognose().getPercentCompletion() вместо
// ShopSalesFact.getPercentCompletion() на вход вместо фактического
// процента выполнения плана — единственное отличие между двумя проходами
// calculate(). erpData в обоих режимах общий — эта функция трогает только
// процент выполнения плана подразделения.
export function toShopSalesPerformanceContext(
    performance: ShopSalesPerformance | null,
    mode: SalaryCalculationMode,
): SalesPerformanceContext | null {
    if (!performance) {
        return null;
    }
    const percentCompletion =
        mode === 'PROGNOSE'
            ? performance.getPrognose().getPercentCompletion()
            : performance.getFact().getPercentCompletion();

    return {
        department: performance.getDepartment(),
        category: performance.getCategory(),
        percentCompletion,
    };
}
