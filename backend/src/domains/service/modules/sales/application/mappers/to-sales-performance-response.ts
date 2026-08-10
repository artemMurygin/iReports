import type { SalesPerformanceResponse } from 'ireports-contracts';
import { SalesPerformance } from '../../domain/value-objects/sales-performance.value-object';
import { toSalesPlanResponse } from './to-sales-plan-response';

export function toSalesPerformanceResponse(
    performance: SalesPerformance,
): SalesPerformanceResponse {
    const fact = performance.getFact();
    const prognose = performance.getPrognose();

    return {
        direction: performance.getDirection(),
        period: performance.getPeriod(),
        department: performance.getDepartment(),
        category: performance.getCategory(),
        plan: toSalesPlanResponse(performance.getPlan()),
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
