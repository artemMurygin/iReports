import {
  EmployeeShort,
  OrderType,
  OrderStatus,
  MarketingSourceShort,
} from '../../integrations/roapp-gateway/roapp-gateway.port';
import { Category } from '../../integrations/roapp/schemas/serviceCatalog.schema';

export function mapEmployeeToUpsert(e: EmployeeShort) {
  return {
    id: e.id,
    firstName: e.first_name,
    lastName: e.last_name,
  };
}

export function mapOrderStatusToUpsert(s: OrderStatus) {
  return {
    id: s.id,
    name: s.name,
    color: s.color,
    grupName: s.group,
  };
}

export function mapOrderTypeToUpsert(t: OrderType) {
  return { id: t.id, name: t.title };
}

export function mapMarketingSourceToUpsert(s: MarketingSourceShort) {
  return { id: s.id, name: s.name };
}

/**
 * Категории завязаны на self-relation по parentId, поэтому родителя нужно
 * upsert'ить раньше потомка — сортируем по глубине через обход дерева.
 */
export function topoSortCategories<T extends Category>(items: T[]): T[] {
  const map = new Map(items.map((i) => [i.id, i]));
  const visited = new Set<number>();
  const result: T[] = [];

  const visit = (item: T) => {
    if (visited.has(item.id)) return;
    if (item.parent_id !== null && map.has(item.parent_id)) {
      visit(map.get(item.parent_id)!);
    }
    visited.add(item.id);
    result.push(item);
  };

  items.forEach(visit);
  return result;
}

export type ServiceCategoryAncestors = {
  workTypeId: number | null;
  brandId: number | null;
  deviceId: number | null;
  serviceTypeId: number | null;
  seriesId: number | null;
};

/**
 * Поднимается от категории услуги к корню и раскладывает путь по уровням
 * иерархии (workType/brand/device/serviceType/series), как того требует
 * плоская схема RoappService в БД.
 */
export function resolveServiceCategoryAncestors(
  categoryId: number | null,
  categoryMap: Map<number, { id: number; parentId: number | null }>,
): ServiceCategoryAncestors {
  if (!categoryId) {
    return {
      workTypeId: null,
      brandId: null,
      deviceId: null,
      serviceTypeId: null,
      seriesId: null,
    };
  }

  const path: number[] = [];
  let current = categoryMap.get(categoryId);

  while (current) {
    path.unshift(current.id);
    current = current.parentId ? categoryMap.get(current.parentId) : undefined;
  }

  // path = [корень(0), workType(1), brand(2), device(3), serviceType(4), series(5), category(6)]
  return {
    workTypeId: path[1] ?? null,
    brandId: path[2] ?? null,
    deviceId: path[3] ?? null,
    serviceTypeId: path[4] ?? null,
    seriesId: path[5] ?? null,
  };
}
