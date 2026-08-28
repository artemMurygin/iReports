import type { ShopSalesPlanScope } from '../value-objects/shop-sales-plan-scope.value-object';

export interface ShopSalesPlanTemplateProps {
    scope: ShopSalesPlanScope;
    turnover: number;
    margin: number;
    // Типы заказов RoApp (RoappOrderType.id), переносимые на автосоздаваемый
    // план; [] = "все типы" (см. sales.prisma). Как и у ShopSalesPlanProps,
    // не используется расчётом shop, но остаётся частью общей формы строки.
    orderTypeIds: number[];
    growthPercent: number;
}

export interface ShopSalesPlanTemplateCreateProps {
    department: number;
    category?: string | null;
    turnover: number;
    margin: number;
    orderTypeIds?: number[];
    growthPercent?: number;
}

export interface ShopSalesPlanTemplateEditProps {
    turnover?: number;
    margin?: number;
    orderTypeIds?: number[];
    growthPercent?: number;
}
