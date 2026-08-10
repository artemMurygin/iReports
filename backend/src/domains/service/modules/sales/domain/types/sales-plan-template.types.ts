import type { SalesDirection } from 'ireports-contracts';
import type { SalesPlanScope } from '../value-objects/sales-plan-scope.value-object';

export interface SalesPlanTemplateProps {
    scope: SalesPlanScope;
    turnover: number;
    margin: number;
    growthPercent: number;
}

export interface SalesPlanTemplateCreateProps {
    direction: SalesDirection;
    department: number;
    category?: number | null;
    turnover: number;
    margin: number;
    growthPercent?: number;
}

export interface SalesPlanTemplateEditProps {
    turnover?: number;
    margin?: number;
    growthPercent?: number;
}
