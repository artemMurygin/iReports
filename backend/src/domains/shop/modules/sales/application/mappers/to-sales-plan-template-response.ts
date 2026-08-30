import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { ShopSalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';

// Зеркало domains/service/modules/sales/application/mappers/
// to-sales-plan-template-response.ts (Фаза 7
// docs/service-shop-boundary-violations-fix) — direction в ответе
// подставляется литералом 'shop'.
export function toShopSalesPlanTemplateResponse(
    template: ShopSalesPlanTemplate,
): SalesPlanTemplateResponse {
    return {
        id: template.id,
        direction: 'shop',
        department: template.department,
        category: template.category,
        turnover: template.turnover,
        margin: template.margin,
        orderTypeIds: template.orderTypeIds,
        growthPercent: template.growthPercent,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
    };
}
