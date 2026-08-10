export const ONLINE_MANAGER_ATTR_ID = '3d26eddb-e7c9-11ef-0a80-04b40036c7c1';

export function extractIdFromHref(
    href: string | null | undefined,
): string | null {
    if (!href) return null;
    return href.split('/').at(-1) ?? null;
}

/**
 * Категории/папки завязаны на self-relation по parentId, поэтому родителя
 * нужно upsert'ить раньше потомка — сортируем обходом дерева.
 */
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
