import type { SalesPerformanceResponse } from 'ireports-contracts';
import { toShopSalesPlanResponse } from './to-shop-sales-plan-response';
import { ShopSalesPerformance } from '../../domain/value-objects/shop-sales-performance.value-object';

// SalesPerformanceResponse (contracts/commands/sales-performance.ts) уже
// направление-агностичен (поле direction: salesDirectionSchema включает и
// 'shop') — контракт Фазы 5 не требует изменений для Фазы 11, см. отчёт
// фазы. С Фазы 7 (docs/service-shop-boundary-violations-fix)
// toShopSalesPlanResponse — собственный маппер домена shop, не
// переиспользует toSalesPlanResponse направления service.
export function toShopSalesPerformanceResponse(
    performance: ShopSalesPerformance,
): SalesPerformanceResponse {
    const fact = performance.getFact();
    const prognose = performance.getPrognose();

    return {
        direction: 'shop',
        period: performance.getPeriod(),
        department: performance.getDepartment(),
        category: performance.getCategory(),
        plan: toShopSalesPlanResponse(performance.getPlan()),
        fact: {
            turnover: fact.getTurnover(),
            margin: fact.getMargin(),
            marginPercent: fact.getMarginPercent(),
            cost: fact.getCost(),
            quantity: fact.getQuantity(),
            averageCheck: fact.getAverageCheck(),
            percentCompletion: fact.getPercentCompletion(),
        },
        prognose: {
            turnover: prognose.getTurnover(),
            margin: prognose.getMargin(),
            marginPercent: prognose.getMarginPercent(),
            quantity: prognose.getQuantity(),
            percentCompletion: prognose.getPercentCompletion(),
        },
    };
}
