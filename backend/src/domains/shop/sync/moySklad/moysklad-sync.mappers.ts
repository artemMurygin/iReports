export const ONLINE_MANAGER_ATTR_ID = '3d26eddb-e7c9-11ef-0a80-04b40036c7c1';

// Атрибуты закупщика БУ техники на позиции отгрузки (Фаза 10, роли
// ONLINE_PURCHASER / OFFLINE_PURCHASER, см.
// docs/payroll/prd-payroll-calculation.md, раздел "Роли магазина").
// В отличие от ONLINE_MANAGER_ATTR_ID выше, UUID этих атрибутов в проде
// НЕИЗВЕСТЕН — доп. поля "Онлайн-закупщик"/"Офлайн-закупщик" ещё могут не
// существовать в справочнике МойСклад (открытый вопрос PRD не был решён
// руками, в отличие от "Онлайн-менеджера"). Поэтому резолвим по имени, а не
// по id — единственное место правки, если атрибут в справочнике МойСклад
// переименуют или заведут под другим именем.
export const PURCHASER_ATTRIBUTE_NAME = {
    ONLINE: 'Онлайн-закупщик',
    OFFLINE: 'Офлайн-закупщик',
} as const;

export function extractIdFromHref(
    href: string | null | undefined,
): string | null {
    if (!href) return null;
    return href.split('/').at(-1) ?? null;
}

interface PurchaserAttributeLike {
    name: string;
    type: string;
    value: unknown;
}

// Приводит значение доп. поля закупщика к строковому внешнему
// идентификатору для EmployeeIdentity (identifierType
// MOY_SKLAD_ONLINE_PURCHASER_FIELD / MOY_SKLAD_OFFLINE_PURCHASER_FIELD, см.
// employee-identity.prisma) — тем же способом, что строковое поле
// «онлайн-менеджер» RemOnline (Фаза 2, identifierType ONLINE_MANAGER_FIELD):
// по значению, а не по ID, потому что связь ломается при переименовании
// значения в справочнике внешней системы.
//
// Тип значения кастомного атрибута в проде заранее не известен (открытый
// вопрос PRD, docs/payroll/plan-payroll-calculation.md, "Блокирующие
// вопросы") — поддерживаем оба варианта:
// - type === 'employee' — value это MetaWrapper { meta: { href } } со
//   ссылкой на сотрудника МойСклад, тот же формат, что у
//   OnlineManagerAttributeSchema в demands.schema.ts. Извлекаем id
//   сотрудника МойСклад из href тем же extractIdFromHref, что и обычные
//   менеджеры (onlineManagerId/offlineManagerId) — сопоставление тогда
//   так же надёжно, как у них.
// - любой другой тип (в первую очередь 'string') — value уже голая строка,
//   используем её как есть.
export function extractPurchaserExternalId(
    attributes: PurchaserAttributeLike[] | undefined,
    attributeName: string,
): string | null {
    const attribute = attributes?.find((a) => a.name === attributeName);
    if (!attribute || attribute.value == null) return null;

    if (attribute.type === 'employee') {
        const href = (attribute.value as { meta?: { href?: string } })?.meta
            ?.href;
        return extractIdFromHref(href);
    }

    return typeof attribute.value === 'string' && attribute.value.trim()
        ? attribute.value
        : null;
}

// spec: shop/moysklad-sync#requirement-категории-товаров-загружаются-от-родителя-к-потомку
export function topoSortFolders<
    T extends { id: string; parentId: string | null },
>(items: T[]): T[] {
    const map = new Map(items.map((i) => [i.id, i]));
    const visited = new Set<string>();
    const result: T[] = [];

    const visit = (item: T) => {
        if (visited.has(item.id)) return;
        if (item.parentId && map.has(item.parentId)) {
            visit(map.get(item.parentId)!);
        }
        visited.add(item.id);
        result.push(item);
    };

    items.forEach(visit);
    return result;
}
