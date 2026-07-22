export type CategoryEdge = {
  id: number | string;
  parentId: number | string | null;
};

// Категория, выбранная в цели/вознаграждении, должна учитывать вложенные категории
// (roapp_service_categories.parent_id / moy_sklad_product_folders.parent_id) —
// см. ARCHITECTURE.md §4.1. Возвращает id корня и всех потомков.
export function collectSubtreeIds(
  all: CategoryEdge[],
  rootId: number | string,
): Set<number | string> {
  const childrenByParent = new Map<number | string, (number | string)[]>();
  for (const edge of all) {
    if (edge.parentId == null) continue;
    const siblings = childrenByParent.get(edge.parentId) ?? [];
    siblings.push(edge.id);
    childrenByParent.set(edge.parentId, siblings);
  }

  const result = new Set<number | string>([rootId]);
  const queue: (number | string)[] = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return result;
}
