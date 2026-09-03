import type { SalesPlanResponse } from 'ireports-contracts';
import { ShopSalesPlan } from '../../domain/entities/sales-plan.entity';

// Зеркало domains/service/modules/sales/application/mappers/
// to-sales-plan-response.ts (Фаза 7 docs/service-shop-boundary-violations-fix,
// sortOrder — Фаза 4 docs/sales-plan-row-drag-and-drop-reorder) — direction
// в ответе подставляется литералом 'shop': ShopSalesPlan сам его не хранит
// (см. WHY в entity). sortOrder — не собственное поле ShopSalesPlan, а
// значение, унаследованное от связанного ShopSalesPlanTemplate.sortOrder
// (см. domain/services/order-sales-plans.ts); null, если для строки нет
// сохранённого шаблона/порядка. Параметр по умолчанию null — вызовы, для
// которых порядок не резолвился (create/update/approve/delete строки), не
// обязаны его передавать.
export function toShopSalesPlanResponse(
    plan: ShopSalesPlan,
    sortOrder: number | null = null,
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
        sortOrder,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
    };
}
