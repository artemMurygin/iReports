import type { ShopSalesPlanScope } from '../value-objects/sales-plan-scope.value-object';

export interface ShopSalesPlanTemplateProps {
    scope: ShopSalesPlanScope;
    turnover: number;
    margin: number;
    // Типы заказов RoApp (RoappOrderType.id), переносимые на автосоздаваемый
    // план; [] = "все типы" (см. sales.prisma). Как и у ShopSalesPlanProps,
    // не используется расчётом shop, но остаётся частью общей формы строки.
    orderTypeIds: number[];
    growthPercent: number;
    // Глобальный порядок строки-категории в таблице плана продаж (Фаза 4,
    // docs/sales-plan-row-drag-and-drop-reorder) — зеркало одноимённого
    // поля SalesPlanTemplateProps направления service. Меняется отдельно
    // от остальных полей, через ShopSalesPlanTemplate.reorder(), а не
    // через update().
    sortOrder: number;
}

export interface ShopSalesPlanTemplateCreateProps {
    department: number;
    category?: string | null;
    turnover: number;
    margin: number;
    orderTypeIds?: number[];
    growthPercent?: number;
    sortOrder?: number;
}

export interface ShopSalesPlanTemplateEditProps {
    turnover?: number;
    margin?: number;
    orderTypeIds?: number[];
    growthPercent?: number;
}
