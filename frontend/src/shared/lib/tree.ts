export interface TreeItem<Id = number> {
    id: Id
    parentId: Id | null
}

export interface TreeNode<T extends TreeItem<Id>, Id = number> {
    item: T
    children: TreeNode<T, Id>[]
}

export function getDirectChildren<T extends TreeItem<Id>, Id = number>(items: T[], parentId: Id | null): T[] {
    return items.filter((item) => item.parentId === parentId)
}

export function getSubtreeIds<T extends TreeItem<Id>, Id = number>(items: T[], rootId: Id): Id[] {
    const ids: Id[] = [rootId]
    const queue: Id[] = [rootId]
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

export function getAncestorIds<T extends TreeItem<Id>, Id = number>(items: T[], id: Id | null): Set<Id> {
    const ids = new Set<Id>()
    if (id === null) return ids
    let current = items.find((item) => item.id === id)
    while (current?.parentId != null) {
        ids.add(current.parentId)
        current = items.find((item) => item.id === current!.parentId)
    }
    return ids
}

export function buildTree<T extends TreeItem<Id>, Id = number>(items: T[], compareFn?: (a: T, b: T) => number): TreeNode<T, Id>[] {
    const map = new Map<Id, TreeNode<T, Id>>()
    for (const item of items) map.set(item.id, { item, children: [] })
    const roots: TreeNode<T, Id>[] = []
    for (const item of items) {
        const node = map.get(item.id)!
        if (item.parentId === null) roots.push(node)
        else map.get(item.parentId)?.children.push(node)
    }
    if (compareFn) {
        const sort = (nodes: TreeNode<T, Id>[]) => {
            nodes.sort((a, b) => compareFn(a.item, b.item))
            nodes.forEach((n) => sort(n.children))
        }
        sort(roots)
    }
    return roots
}
