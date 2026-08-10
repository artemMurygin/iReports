import type { SalesPlanResponse } from 'ireports-contracts';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';

export function toSalesPlanResponse(plan: SalesPlan): SalesPlanResponse {
    return {
        id: plan.id,
        direction: plan.direction,
        department: plan.department,
        category: plan.category,
        period: plan.period,
        turnover: plan.turnover,
        margin: plan.margin,
        source: plan.source,
        status: plan.status,
        approvedBy: plan.approvedBy,
        approvedAt: plan.approvedAt,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
    };
}
