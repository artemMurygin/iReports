import { Search, X } from 'lucide-react'

import type { CategorySearchClasses } from './categoryOverlay.ts'

export type CategorySearchInputProps = {
    query: string
    onQueryChange: (query: string) => void
    autoFocus?: boolean
    classes: CategorySearchClasses
}

export function CategorySearchInput({ query, onQueryChange, autoFocus, classes }: CategorySearchInputProps) {
    return (
        <div className={classes.row}>
            <Search className={classes.icon} />
            <input
                autoFocus={autoFocus}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Поиск по категориям"
                className={classes.input}
            />
            {query !== '' && (
                <button
                    type="button"
                    onClick={() => onQueryChange('')}
                    aria-label="Очистить поиск"
                    className="text-ink-faint hover:text-ink"
                >
                    <X className={classes.clearIcon} />
                </button>
            )}
        </div>
    )
}
