export const ONLINE_MANAGER_ATTR_ID = '3d26eddb-e7c9-11ef-0a80-04b40036c7c1';

// Атрибуты закупщика БУ техники на КАРТОЧКЕ ТОВАРА (product/variant), роли
// ONLINE_PURCHASER / OFFLINE_PURCHASER, см.
// docs/payroll/prd-payroll-calculation.md, раздел "Роли магазина". Изначально
// (Фаза 10) предполагалось, что эти доп. поля лежат на позиции отгрузки —
// предположение не подтвердилось (МойСклад не поддерживает кастомные
// атрибуты на строке позиции документа, только на сущностях справочника),
// подтверждено владельцем аккаунта: поле реально на карточке товара.
//
// Название атрибута тоже было неверным изначально ("Онлайн/Офлайн-
// закупщик") — проверено live-запросом GET /entity/product/metadata/
// attributes к реальному аккаунту: атрибуты называются "Онлайн-скупщик" /
// "Офлайн-скупщик" (id dfddb2fa-9b0a-11f1-.../dfddb03b-9b0a-11f1-...,
// оба type: employee). УУID этих атрибутов в проде теперь известен, но
// резолвим по-прежнему по имени, а не по id (в отличие от
// ONLINE_MANAGER_ATTR_ID выше) — единственное место правки, если атрибут в
// справочнике МойСклад переименуют.
export const PURCHASER_ATTRIBUTE_NAME = {
    ONLINE: 'Онлайн-скупщик',
    OFFLINE: 'Офлайн-скупщик',
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
