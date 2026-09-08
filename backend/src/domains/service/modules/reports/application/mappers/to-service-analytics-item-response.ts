import type { ServiceAnalyticsItemResponse } from 'ireports-contracts';
import { ServiceMetrics } from '../../domain/value-objects/service-metrics.value-object';
import { PeriodBreakdownEntry } from '../../domain/services/period-breakdown.calculator';

// Метрики VO + breakdown (уже плоские данные из доменного калькулятора) →
// форма контракта одной услуги в GetServicesAnalyticsResponse.services[].
export function toServiceAnalyticsItemResponse(
    serviceId: number,
    serviceName: string,
    categoryId: number | null,
    retailPrice: number,
    metrics: ServiceMetrics,
    breakdown: PeriodBreakdownEntry[],
): ServiceAnalyticsItemResponse {
    return {
        serviceId,
        serviceName,
        categoryId,
        retailPrice,
        totalCount: metrics.getTotalCount(),
        totalRevenue: metrics.getTotalRevenue(),
        totalProfit: metrics.getTotalProfit(),
        totalEngineerBonus: metrics.getTotalEngineerBonus(),
        avgServicePrice: metrics.getAvgServicePrice(),
        avgOrderCheck: metrics.getAvgOrderCheck(),
        breakdown,
    };
}
