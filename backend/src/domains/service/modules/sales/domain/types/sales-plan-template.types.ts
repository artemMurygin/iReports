import type { SalesDirection } from 'ireports-contracts';
import type { SalesPlanScope } from '../value-objects/sales-plan-scope.value-object';

export interface SalesPlanTemplateProps {
    scope: SalesPlanScope;
    turnover: number;
    margin: number;
    // Типы заказов RoApp (RoappOrderType.id), переносимые на план,
    // построенный из этого шаблона; [] = "все типы" (см. sales.prisma).
    orderTypeIds: number[];
    growthPercent: number;
}

export interface SalesPlanTemplateCreateProps {
    direction: SalesDirection;
    department: number;
    category?: string | null;
    turnover: number;
    margin: number;
    orderTypeIds?: number[];
    growthPercent?: number;
}

export interface SalesPlanTemplateEditProps {
    turnover?: number;
    margin?: number;
    orderTypeIds?: number[];
    growthPercent?: number;
}
