import type { SalesPerformanceResponse } from 'ireports-contracts';
import { toSalesPlanResponse } from '@/domains/service/modules/sales/application/mappers/to-sales-plan-response';
import { ShopSalesPerformance } from '../../domain/value-objects/shop-sales-performance.value-object';

// SalesPerformanceResponse (contracts/commands/sales-performance.ts) уже
// направление-агностичен (поле direction: salesDirectionSchema включает и
// 'shop') — контракт Фазы 5 не требует изменений для Фазы 11, см. отчёт
// фазы. toSalesPlanResponse переиспользуется из направления service по той
// же причине, что и SalesPlan/EnsureSalesPlansForPeriodService (см.
// ShopSalesPerformance) — это генерик-маппер общей Prisma-модели плана, не
// ERP-специфичный код.
export function toShopSalesPerformanceResponse(
    performance: ShopSalesPerformance,
): SalesPerformanceResponse {
    const fact = performance.getFact();
    const prognose = performance.getPrognose();

    return {
        direction: performance.getPlan().direction,
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
