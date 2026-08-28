import type { SalesPlanSource, SalesPlanStatus } from 'ireports-contracts';
import type { ShopSalesPlanScope } from '../value-objects/shop-sales-plan-scope.value-object';
import type { ShopSalesPlanApproval } from '../value-objects/shop-sales-plan-approval.value-object';

// SalesPlanSource/SalesPlanStatus — типы из контракта, общего для обоих
// направлений (см. contracts/commands/sales-plan.ts), не доменный код
// service — переиспользовать их здесь не нарушает независимость доменов
// (то же, что делает и sales-plan.types.ts направления service).
export type { SalesPlanSource, SalesPlanStatus };

export interface ShopSalesPlanProps {
    scope: ShopSalesPlanScope;
    // 'YYYY-MM', формат валидируется через Period.create() в validate() —
    // самим значением, а не отдельным VO-полем (см. ShopSalesPlan.validate()).
    period: string;
    turnover: number;
    margin: number;
    // Типы заказов RoApp (RoappOrderType.id), заказы которых учитываются в
    // факте/прогнозе этой строки; [] = "все типы" (см. sales.prisma). Для
    // shop это поле не используется расчётом (ProductSold/UsedProductSold
    // не фильтруют по типам заказов), но остаётся частью общей формы
    // строки Prisma-модели.
    orderTypeIds: number[];
    source: SalesPlanSource;
    status: SalesPlanStatus;
    approval: ShopSalesPlanApproval | null;
}

export interface ShopSalesPlanCreateProps {
    department: number;
    category?: string | null;
    period: string;
    turnover: number;
    margin: number;
    orderTypeIds?: number[];
    source: SalesPlanSource;
}

export interface ShopSalesPlanEditProps {
    turnover?: number;
    margin?: number;
    orderTypeIds?: number[];
}
