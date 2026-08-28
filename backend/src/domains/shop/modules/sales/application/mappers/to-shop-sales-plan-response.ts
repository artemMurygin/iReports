import type { SalesPlanResponse } from 'ireports-contracts';
import { ShopSalesPlan } from '../../domain/entities/shop-sales-plan.entity';

// Зеркало domains/service/modules/sales/application/mappers/
// to-sales-plan-response.ts (Фаза 7 docs/service-shop-boundary-violations-fix)
// — direction в ответе подставляется литералом 'shop': ShopSalesPlan сам
// его не хранит (см. WHY в entity).
export function toShopSalesPlanResponse(
    plan: ShopSalesPlan,
): SalesPlanResponse {
    return {
        id: plan.id,
        direction: 'shop',
        department: plan.department,
        category: plan.category,
        period: plan.period,
        turnover: plan.turnover,
        margin: plan.margin,
        orderTypeIds: plan.orderTypeIds,
        source: plan.source,
        status: plan.status,
        approvedBy: plan.approvedBy,
        approvedAt: plan.approvedAt,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
    };
}
