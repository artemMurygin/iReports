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
    // Глобальный порядок строки-категории в таблице плана продаж (см.
    // комментарий у sortOrder в sales.prisma) — меняется отдельно от
    // остальных полей, через SalesPlanTemplate.reorder(), а не через
    // update().
    sortOrder: number;
}

export interface SalesPlanTemplateCreateProps {
    direction: SalesDirection;
    department: number;
    category?: string | null;
    turnover: number;
    margin: number;
    orderTypeIds?: number[];
    growthPercent?: number;
    sortOrder?: number;
}

export interface SalesPlanTemplateEditProps {
    turnover?: number;
    margin?: number;
    orderTypeIds?: number[];
    growthPercent?: number;
}
