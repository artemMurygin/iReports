import type { SalesPlanTemplateResponse } from 'ireports-contracts';
import { SalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';

export function toSalesPlanTemplateResponse(
    template: SalesPlanTemplate,
): SalesPlanTemplateResponse {
    return {
        id: template.id,
        direction: template.direction,
        department: template.department,
        category: template.category,
        turnover: template.turnover,
        margin: template.margin,
        growthPercent: template.growthPercent,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
    };
}
