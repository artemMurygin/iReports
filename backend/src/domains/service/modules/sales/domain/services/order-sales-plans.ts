import { SalesPlan } from '../entities/sales-plan.entity';
import { SalesPlanTemplate } from '../entities/sales-plan-template.entity';

export interface OrderedSalesPlan {
    plan: SalesPlan;
    // spec: service/sales#requirement-глобальный-порядок-строк-плана-наследуется-от-шаблона
    //
    // null, если для комбинации (department, category) строки плана нет
    // сохранённого шаблона.
    sortOrder: number | null;
}

function scopeKey(department: number, category: string | null): string {
    return `${department}:${category ?? 'null'}`;
}

export function buildTemplateSortOrderMap(
    templates: SalesPlanTemplate[],
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

// spec: service/sales#requirement-глобальный-порядок-строк-плана-наследуется-от-шаблона
//
// Глобальный (общий для всех пользователей) порядок строк — см.
// docs/sales-plan-row-drag-and-drop-reorder. Хранится не на самой строке
// SalesPlan (её id и вообще существование меняются каждый месяц), а на
// связанном SalesPlanTemplate — период-независимой сущности на том же
// естественном ключе (direction, department, category). Группировка по
// отделу сохраняется как и в прежней сортировке (departmentId asc,
// categoryId asc, см. SalesPlanRepository.findByDirectionAndPeriod) —
// sortOrder работает уже внутри отдела.
export function orderSalesPlansByTemplate(
    plans: SalesPlan[],
    templates: SalesPlanTemplate[],
): OrderedSalesPlan[] {
    const sortOrderByScope = buildTemplateSortOrderMap(templates);

    const withOrder: OrderedSalesPlan[] = plans.map((plan) => ({
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
        // spec: service/sales#scenario-строка-без-связанного-шаблона-уходит-в-конец-списка-отдела
        if (a.sortOrder !== null) {
            return -1;
        }
        if (b.sortOrder !== null) {
            return 1;
        }
        return (a.plan.category ?? '').localeCompare(b.plan.category ?? '');
    });
}
