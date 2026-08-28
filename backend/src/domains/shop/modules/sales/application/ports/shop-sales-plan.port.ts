import { ShopSalesPlan } from '../../domain/entities/shop-sales-plan.entity';

// Зеркало domains/service/modules/sales/application/ports/sales-plan.port.ts
// (Фаза 7 docs/service-shop-boundary-violations-fix) — независимый порт для
// направления shop, без параметра direction: он зафиксирован реализацией
// (см. ShopSalesPlanRepository).
export interface ShopSalesPlanRepositoryPort {
    insert(entity: ShopSalesPlan): Promise<void>;
    update(entity: ShopSalesPlan): Promise<void>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<ShopSalesPlan | null>;
    findByIds(ids: string[]): Promise<ShopSalesPlan[]>;

    // Естественный ключ строки плана — вход для проверки уникальности при
    // создании (@@unique в sales.prisma в паре с фиксированным
    // direction: 'shop' — последняя линия защиты, эта проверка ради
    // дружелюбного 409 вместо ошибки БД).
    findByScope(
        department: number,
        category: string | null,
        period: string,
    ): Promise<ShopSalesPlan | null>;

    // Все строки месяца направления shop — вход и для чтения "план месяца"
    // (ListShopSalesPlansService), и для массового утверждения "весь месяц"
    // (ApproveShopSalesPlanHandler), и для проверки готовности к закрытию
    // периода (CloseShopAccountingPeriodHandler).
    findByPeriod(period: string): Promise<ShopSalesPlan[]>;
}

export const SHOP_SALES_PLAN_REPOSITORY = Symbol('SHOP_SALES_PLAN_REPOSITORY');
