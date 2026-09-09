import { Fragment, type ReactNode } from 'react'
import { ChevronRight, Folder, Layers } from 'lucide-react'
import type { ProductCategoryResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import type { TreeNode } from '@/shared/lib/tree.ts'
import type { CategorySearchMatch } from '@/pages/GoodsTurnoverReport/model/categoryTree.ts'

import { ALL_CATEGORIES_LABEL, type CategoryTreeClasses } from './categoryOverlay.ts'

export type CategoryTreeBodyProps = {
    tree: TreeNode<ProductCategoryResponse>[]
    query: string
    searchResults: CategorySearchMatch[]
    selectedId: number | null
    expandedIds: Set<number>
    onToggleExpanded: (id: number) => void
    onSelect: (id: number | null) => void
    mark: ReactNode
    classes: CategoryTreeClasses
}

/** Содержимое скроллируемой области поповера: закреплённая строка «Все категории» + дерево
 * товарных категорий с разворачиванием, либо плоский список результатов поиска с хлебной крошкой
 * предков. Портировано из `pages/ServicesReport/ui/CategoryTreeSelect/ui/CategoryTreeBody.tsx`
 * (openspec/changes/service-turnover-report, задача 17) под `ProductCategoryResponse` (`GET
 * /v1/service/warehouse/product-categories`) и `selectedId: number | null` вместо `string | null` —
 * `useGoodsTurnoverReportPage.ts` (задача 15, уже реализован) хранит `categoryId` числом
 * напрямую, поэтому сравнения/колбэк здесь без `String()`. */
export function CategoryTreeBody(props: CategoryTreeBodyProps) {
    const { tree, query, searchResults, selectedId, expandedIds, onToggleExpanded, onSelect, mark, classes } = props

    function renderNode(node: TreeNode<ProductCategoryResponse>, depth: number) {
        const hasChildren = node.children.length > 0
        const isExpanded = expandedIds.has(node.item.id)
        const isSelected = selectedId === node.item.id

        return (
            <Fragment key={node.item.id}>
                <div
                    className={cn(classes.row, isSelected ? 'bg-brand-soft' : 'hover:bg-canvas')}
                    style={{ paddingLeft: 10 + depth * 16 }}
                >
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onToggleExpanded(node.item.id)
                            }}
                            aria-label={isExpanded ? 'Свернуть категорию' : 'Развернуть категорию'}
                            className={classes.toggle}
                        >
                            <ChevronRight className={cn(classes.toggleIcon, isExpanded && 'rotate-90')} />
                        </button>
                    ) : (
                        <span className={classes.spacer} />
                    )}
                    <button
                        type="button"
                        onClick={() => onSelect(node.item.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                        <Folder className={classes.folderIcon} />
                        <span
                            className={cn(
                                classes.nodeLabel,
                                isSelected ? 'font-semibold text-ink' : 'font-medium text-ink',
                            )}
                        >
                            {node.item.name}
                        </span>
                    </button>
                    {isSelected && mark}
                </div>
                {hasChildren && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
            </Fragment>
        )
    }

    if (query.trim() === '') {
        return (
            <>
                <button
                    type="button"
                    onClick={() => onSelect(null)}
                    className={cn(classes.allRow, selectedId === null ? 'bg-brand-soft' : 'hover:bg-canvas')}
                >
                    <Layers className={classes.allIcon} />
                    <span
                        className={cn(
                            classes.allLabel,
                            selectedId === null ? 'font-semibold text-ink' : 'font-medium text-ink',
                        )}
                    >
                        {ALL_CATEGORIES_LABEL}
                    </span>
                    {selectedId === null && mark}
                </button>
                <div className="my-1 h-px w-full bg-hairline" />
                {tree.length === 0 ? (
                    <p className="px-2.5 py-2 font-ui text-xs text-ink-faint">Категории не найдены</p>
                ) : (
                    tree.map((node) => renderNode(node, 0))
                )}
            </>
        )
    }

    if (searchResults.length === 0)
        return <p className="px-2.5 py-2 font-ui text-xs text-ink-faint">Ничего не найдено</p>

    return searchResults.map(({ category, ancestors }) => (
        <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={cn(classes.matchRow, selectedId === category.id ? 'bg-brand-soft' : 'hover:bg-canvas')}
        >
            <span className={classes.matchName}>{category.name}</span>
            {ancestors.length > 0 && (
                <span className="truncate font-ui text-[11px] text-ink-faint">
                    {ancestors.map((a) => a.name).join(' / ')}
                </span>
            )}
        </button>
    ))
}
