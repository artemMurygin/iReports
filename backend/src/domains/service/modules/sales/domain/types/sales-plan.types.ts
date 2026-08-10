import type {
    SalesDirection,
    SalesPlanSource,
    SalesPlanStatus,
} from 'ireports-contracts';
import type { SalesPlanScope } from '../value-objects/sales-plan-scope.value-object';
import type { SalesPlanApproval } from '../value-objects/sales-plan-approval.value-object';

export type { SalesDirection, SalesPlanSource, SalesPlanStatus };

export interface SalesPlanProps {
    scope: SalesPlanScope;
    // 'YYYY-MM', формат валидируется через Period.create() в validate() —
    // самим значением, а не отдельным VO-полем (см. SalesPlan.validate()).
    period: string;
    turnover: number;
    margin: number;
    source: SalesPlanSource;
    status: SalesPlanStatus;
    approval: SalesPlanApproval | null;
}

export interface SalesPlanCreateProps {
    direction: SalesDirection;
    department: number;
    category?: number | null;
    period: string;
    turnover: number;
    margin: number;
    source: SalesPlanSource;
}

export interface SalesPlanEditProps {
    turnover?: number;
    margin?: number;
}
