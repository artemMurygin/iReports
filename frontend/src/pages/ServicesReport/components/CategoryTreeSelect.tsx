import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Layers, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { cn } from '@/shared/lib/twUtils'
import type { ServiceCategory } from '../types'

interface TreeNode {
    id: number
    name: string
    children: TreeNode[]
}

function buildTree(categories: ServiceCategory[]): TreeNode[] {
    const map = new Map<number, TreeNode>()
    for (const cat of categories) map.set(cat.id, { id: cat.id, name: cat.name, children: [] })
    const roots: TreeNode[] = []
    for (const cat of categories) {
        const node = map.get(cat.id)!
        if (cat.parentId === null) roots.push(node)
        else map.get(cat.parentId)?.children.push(node)
    }
    const sort = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        nodes.forEach((n) => sort(n.children))
    }
    sort(roots)
    return roots
}

function getAncestorIds(categories: ServiceCategory[], selectedId: string | null): Set<number> {
    const ids = new Set<number>()
    if (!selectedId) return ids
    let current = categories.find((c) => c.id === Number(selectedId))
    while (current?.parentId != null) {
        ids.add(current.parentId)
        current = categories.find((c) => c.id === current!.parentId)
    }
    return ids
}

function TreeNodeRow({
    node,
    selectedId,
    expandedIds,
    onSelect,
    depth,
}: {
    node: TreeNode
    selectedId: string | null
    expandedIds: Set<number>
    onSelect: (id: string) => void
    depth: number
}) {
    const [expanded, setExpanded] = useState(() => expandedIds.has(node.id))
    const isSelected = String(node.id) === selectedId

    return (
        <div>
            <div
                className={cn(
                    'flex items-center gap-1 rounded-3xl px-1 py-1 text-sm cursor-pointer hover:bg-gray-100 transition-colors',
                    isSelected && 'bg-gray-900 text-white hover:bg-gray-800',
                )}
                style={{ paddingLeft: `${depth * 14 + 4}px` }}
            >
                <button
                    className="flex items-center justify-center w-4 h-4 shrink-0"
                    onClick={(e) => {
                        e.stopPropagation()
                        if (node.children.length) setExpanded((v) => !v)
                    }}
                >
                    {node.children.length > 0 ? (
                        expanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        )
                    ) : null}
                </button>
                <span className="flex-1 truncate" onClick={() => onSelect(String(node.id))}>
                    {node.name}
                </span>
            </div>
            {expanded &&
                node.children.map((child) => (
                    <TreeNodeRow
                        key={child.id}
                        node={child}
                        selectedId={selectedId}
                        expandedIds={expandedIds}
                        onSelect={onSelect}
                        depth={depth + 1}
                    />
                ))}
        </div>
    )
}

interface Props {
    categories: ServiceCategory[]
    selectedId: string | null
    onChange: (id: string | null) => void
}

export function CategoryTreeSelect({ categories, selectedId, onChange }: Props) {
    const [open, setOpen] = useState(false)
    const tree = useMemo(() => buildTree(categories), [categories])
    const selectedName = useMemo(
        () =>
            selectedId ? (categories.find((c) => String(c.id) === selectedId)?.name ?? null) : null,
        [selectedId, categories],
    )
    const expandedIds = useMemo(
        () => getAncestorIds(categories, selectedId),
        [categories, selectedId],
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button className="flex items-center justify-between gap-2 h-9 px-3 rounded-md border border-gray-200 w-[240px] cursor-pointer hover:border-gray-300 transition-colors text-sm text-gray-700">
                    <Layers className="w-4 h-4 text-gray-500 shrink-0" />
                    <span className="flex-1 truncate text-left">
                        {selectedName ?? 'Все категории'}
                    </span>
                    {selectedId && (
                        <X
                            className="w-4 h-4 text-gray-400 hover:text-gray-600 shrink-0"
                            onClick={(e) => {
                                e.stopPropagation()
                                onChange(null)
                            }}
                        />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-1 max-h-[400px] overflow-y-auto" align="start">
                {tree.map((node) => (
                    <TreeNodeRow
                        key={node.id}
                        node={node}
                        selectedId={selectedId}
                        expandedIds={expandedIds}
                        onSelect={(id) => {
                            onChange(id)
                            setOpen(false)
                        }}
                        depth={0}
                    />
                ))}
            </PopoverContent>
        </Popover>
    )
}
