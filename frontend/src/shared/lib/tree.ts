export interface TreeItem {
    id: number
    parentId: number | null
}

export interface TreeNode<T extends TreeItem> {
    item: T
    children: TreeNode<T>[]
}

export function getDirectChildren<T extends TreeItem>(items: T[], parentId: number | null): T[] {
    return items.filter((item) => item.parentId === parentId)
}

export function getSubtreeIds<T extends TreeItem>(items: T[], rootId: number): number[] {
    const ids: number[] = [rootId]
    const queue: number[] = [rootId]
    while (queue.length > 0) {
        const current = queue.shift()!
        for (const item of items) {
            if (item.parentId === current) {
                ids.push(item.id)
                queue.push(item.id)
            }
        }
    }
    return ids
}

export function getAncestorIds<T extends TreeItem>(items: T[], id: number | null): Set<number> {
    const ids = new Set<number>()
    if (id === null) return ids
    let current = items.find((item) => item.id === id)
    while (current?.parentId != null) {
        ids.add(current.parentId)
        current = items.find((item) => item.id === current!.parentId)
    }
    return ids
}

export function buildTree<T extends TreeItem>(items: T[], compareFn?: (a: T, b: T) => number): TreeNode<T>[] {
    const map = new Map<number, TreeNode<T>>()
    for (const item of items) map.set(item.id, { item, children: [] })
    const roots: TreeNode<T>[] = []
    for (const item of items) {
        const node = map.get(item.id)!
        if (item.parentId === null) roots.push(node)
        else map.get(item.parentId)?.children.push(node)
    }
    if (compareFn) {
        const sort = (nodes: TreeNode<T>[]) => {
            nodes.sort((a, b) => compareFn(a.item, b.item))
            nodes.forEach((n) => sort(n.children))
        }
        sort(roots)
    }
    return roots
}