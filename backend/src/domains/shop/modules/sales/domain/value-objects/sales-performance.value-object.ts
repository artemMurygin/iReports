import { ValueObject } from '@/shared/domain/value-object.base';
import { ShopSalesPlan } from '@/domains/shop/modules/sales/domain/entities/sales-plan.entity';
import { SalesPrognose } from '@/shared/domain/sales-prognose.value-object';
import { ShopSalesFact } from './sales-fact.value-object';

export interface ShopSalesPerformanceProps {
    plan: ShopSalesPlan;
    fact: ShopSalesFact;
    prognose: SalesPrognose;
    // Унаследованный от связанного ShopSalesPlanTemplate.sortOrder порядок
    // строки (см. domain/services/order-sales-plans.ts) — null, если для
    // строки нет сохранённого шаблона/порядка. Присутствует здесь только
    // ради переноса в ответ (toShopSalesPerformanceResponse), на
    // fact/prognose не влияет. Зеркало SalesPerformance направления service
    // (Фаза 4, docs/sales-plan-row-drag-and-drop-reorder).
    sortOrder: number | null;
}

// Агрегат "план + факт + прогноз" на одну строку (department, category,
// period) для направления shop — зеркало SalesPerformance направления
// service (Фаза 5), но с ShopSalesFact вместо SalesFact.
//
// ShopSalesPlan (`plan`) — с Фазы 7 (docs/service-shop-boundary-violations-fix)
// собственная, независимая реализация домена shop (entity/port/repository/
// мапперы в domains/shop/modules/sales), а не сущность SalesPlan
// направления service: обе таблицы (sales_plans/sales_plan_templates)
// остаются общими на уровне Prisma-схемы (дискриминатор direction), но
// доменный код больше не переиспользуется между доменами — см. WHY в
// ShopSalesPlan. ShopSalesFact и весь ERP-специфичный код (MoySkladDemand)
// остаются самостоятельными для shop, как и раньше.
export class ShopSalesPerformance extends ValueObject<ShopSalesPerformanceProps> {
    static create(
        plan: ShopSalesPlan,
        fact: ShopSalesFact,
        prognose: SalesPrognose,
        sortOrder: number | null = null,
    ): ShopSalesPerformance {
        return new ShopSalesPerformance({ plan, fact, prognose, sortOrder });
    }

    getPeriod(): string {
        return this.props.plan.period;
    }

    getDepartment(): number {
        return this.props.plan.department;
    }

    getCategory(): string | null {
        return this.props.plan.category;
    }

    getPlan(): ShopSalesPlan {
        return this.props.plan;
    }

    getFact(): ShopSalesFact {
        return this.props.fact;
    }

    getPrognose(): SalesPrognose {
        return this.props.prognose;
    }

    getSortOrder(): number | null {
        return this.props.sortOrder;
    }
}
