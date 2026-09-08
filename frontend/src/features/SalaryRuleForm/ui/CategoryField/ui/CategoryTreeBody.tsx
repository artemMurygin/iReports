import { Fragment, type ReactNode } from 'react'
import { ChevronRight, Folder, Layers } from 'lucide-react'
import type { CatalogCategoryResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import type { CategorySearchMatch } from '../../../model/catalogTree.ts'

import { ALL_CATEGORIES_LABEL, type CategoryTreeClasses } from './categoryOverlay.ts'

export type CategoryTreeBodyProps = {
    categories: CatalogCategoryResponse[]
    query: string
    searchResults: CategorySearchMatch[]
    selectedId: string | null
    expandedIds: Set<string>
    onToggleExpanded: (id: string) => void
    onSelect: (id: string | null) => void
    mark: ReactNode
    classes: CategoryTreeClasses
}

/** Содержимое скроллируемой области обоих оверлеев: закреплённая строка «Все категории» + дерево
 * категорий с разворачиванием, либо плоский список результатов поиска. Оверлеи отличаются только
 * строками классов и отметкой выбранной строки (`mark`), поэтому разметка тут одна на двоих. */
export function CategoryTreeBody(props: CategoryTreeBodyProps) {
    const { categories, query, searchResults, selectedId, expandedIds, onToggleExpanded, onSelect, mark, classes } =
        props

    function renderNode(node: CatalogCategoryResponse, depth: number) {
        const hasChildren = node.children.length > 0
        const isExpanded = expandedIds.has(node.id)
        const isSelected = selectedId === node.id

        return (
            <Fragment key={node.id}>
                <div
                    className={cn(classes.row, isSelected ? 'bg-brand-soft' : 'hover:bg-canvas')}
                    style={{ paddingLeft: 10 + depth * 16 }}
                >
                    {hasChildren ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation()
                                onToggleExpanded(node.id)
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
                        onClick={() => onSelect(node.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                        <Folder className={classes.folderIcon} />
                        <span
                            className={cn(
                                classes.nodeLabel,
                                isSelected ? 'font-semibold text-ink' : 'font-medium text-ink',
                            )}
                        >
                            {node.name}
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
                {categories.length === 0 ? (
                    <p className="px-2.5 py-2 font-ui text-xs text-ink-faint">Категории не найдены</p>
                ) : (
                    categories.map((node) => renderNode(node, 0))
                )}
            </>
        )
    }

    if (searchResults.length === 0)
        return <p className="px-2.5 py-2 font-ui text-xs text-ink-faint">Ничего не найдено</p>

    return searchResults.map(({ node, ancestors }) => (
        <button
            key={node.id}
            type="button"
            onClick={() => onSelect(node.id)}
            className={cn(classes.matchRow, selectedId === node.id ? 'bg-brand-soft' : 'hover:bg-canvas')}
        >
            <span className={classes.matchName}>{node.name}</span>
            {ancestors.length > 0 && (
                <span className="truncate font-ui text-[11px] text-ink-faint">
                    {ancestors.map((a) => a.name).join(' / ')}
                </span>
            )}
        </button>
    ))
}
