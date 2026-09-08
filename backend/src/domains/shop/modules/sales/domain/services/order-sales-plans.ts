import { ShopSalesPlan } from '../entities/sales-plan.entity';
import { ShopSalesPlanTemplate } from '../entities/sales-plan-template.entity';

// Зеркало domains/service/modules/sales/domain/services/order-sales-plans.ts
// (Фаза 1, docs/sales-plan-row-drag-and-drop-reorder) — независимая копия
// для направления shop, оперирующая ShopSalesPlan/ShopSalesPlanTemplate
// вместо SalesPlan/SalesPlanTemplate направления service (ни direction, ни
// чужие доменные классы сюда не попадают — см. WHY в ShopSalesPlan/
// ShopSalesPlanTemplate).
export interface OrderedShopSalesPlan {
    plan: ShopSalesPlan;
    // Порядок, унаследованный от связанного ShopSalesPlanTemplate.sortOrder
    // — null, если для комбинации (department, category) строки плана нет
    // сохранённого шаблона.
    sortOrder: number | null;
}

function scopeKey(department: number, category: string | null): string {
    return `${department}:${category ?? 'null'}`;
}

export function buildTemplateSortOrderMap(
    templates: ShopSalesPlanTemplate[],
): Map<string, number> {
    const map = new Map<string, number>();
    for (const template of templates) {
        map.set(
            scopeKey(template.department, template.category),
            template.sortOrder,
        );
    }
    return map;
}

// Глобальный (общий для всех пользователей) порядок строк плана продаж —
// см. docs/sales-plan-row-drag-and-drop-reorder. Хранится не на самой
// строке ShopSalesPlan (её id и вообще существование меняются каждый
// месяц), а на связанном ShopSalesPlanTemplate — период-независимой
// сущности на том же естественном ключе (department, category).
// spec: shop/sales#requirement-глобальный-порядок-строк-плана-наследуется-от-шаблона
export function orderShopSalesPlansByTemplate(
    plans: ShopSalesPlan[],
    templates: ShopSalesPlanTemplate[],
): OrderedShopSalesPlan[] {
    const sortOrderByScope = buildTemplateSortOrderMap(templates);

    const withOrder: OrderedShopSalesPlan[] = plans.map((plan) => ({
        plan,
        sortOrder:
            sortOrderByScope.get(scopeKey(plan.department, plan.category)) ??
            null,
    }));

    return withOrder.sort((a, b) => {
        if (a.plan.department !== b.plan.department) {
            return a.plan.department - b.plan.department;
        }
        if (a.sortOrder !== null && b.sortOrder !== null) {
            return a.sortOrder - b.sortOrder;
        }
        // Ровно один из них не null — строка со связанным шаблоном всегда
        // раньше строки без него (см. заголовок комментария выше).
        if (a.sortOrder !== null) {
            return -1;
        }
        if (b.sortOrder !== null) {
            return 1;
        }
        return (a.plan.category ?? '').localeCompare(b.plan.category ?? '');
    });
}
