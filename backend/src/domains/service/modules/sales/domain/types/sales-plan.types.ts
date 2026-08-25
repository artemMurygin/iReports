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
    // Типы заказов RoApp (RoappOrderType.id), заказы которых учитываются в
    // факте/прогнозе этой строки; [] = "все типы" (см. sales.prisma).
    // Примитив, а не value object — id справочника без собственных
    // инвариантов кроме "число", сам справочник read-only и живёт вне
    // этого модуля (domains/service/modules/reports).
    orderTypeIds: number[];
    source: SalesPlanSource;
    status: SalesPlanStatus;
    approval: SalesPlanApproval | null;
}

export interface SalesPlanCreateProps {
    direction: SalesDirection;
    department: number;
    category?: string | null;
    period: string;
    turnover: number;
    margin: number;
    orderTypeIds?: number[];
    source: SalesPlanSource;
}

export interface SalesPlanEditProps {
    turnover?: number;
    margin?: number;
    orderTypeIds?: number[];
}
