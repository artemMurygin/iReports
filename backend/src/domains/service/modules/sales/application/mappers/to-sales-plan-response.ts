import type { SalesPlanResponse } from 'ireports-contracts';
import { SalesPlan } from '../../domain/entities/sales-plan.entity';

// sortOrder — не собственное поле SalesPlan (см. sales.prisma), а значение,
// унаследованное от связанного SalesPlanTemplate.sortOrder (см.
// domain/services/order-sales-plans.ts); null, если для строки нет
// сохранённого шаблона/порядка. Параметр по умолчанию null — вызовы, для
// которых порядок не резолвился (create/update/approve/delete строки), не
// обязаны его передавать.
export function toSalesPlanResponse(
    plan: SalesPlan,
    sortOrder: number | null = null,
): SalesPlanResponse {
    return {
        id: plan.id,
        direction: plan.direction,
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
