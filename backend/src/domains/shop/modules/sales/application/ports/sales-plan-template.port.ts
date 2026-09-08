import { ShopSalesPlanTemplate } from '../../domain/entities/sales-plan-template.entity';

// Зеркало domains/service/modules/sales/application/ports/
// sales-plan-template.port.ts (Фаза 7
// docs/service-shop-boundary-violations-fix) — независимый порт для
// направления shop, без параметра direction: он зафиксирован реализацией
// (см. ShopSalesPlanTemplateRepository).
export interface ShopSalesPlanTemplateRepositoryPort {
    insert(entity: ShopSalesPlanTemplate): Promise<void>;
    update(entity: ShopSalesPlanTemplate): Promise<void>;

    // Естественный ключ строки шаблона — вход для upsert-семантики PUT
    // /v1/shop/sales/plan_template (см. PutShopSalesPlanTemplateHandler).
    findByScope(
        department: number,
        category: string | null,
    ): Promise<ShopSalesPlanTemplate | null>;

    findAll(): Promise<ShopSalesPlanTemplate[]>;
}

export const SHOP_SALES_PLAN_TEMPLATE_REPOSITORY = Symbol(
    'SHOP_SALES_PLAN_TEMPLATE_REPOSITORY',
);
