import { Search, X } from 'lucide-react'

import type { CategorySearchClasses } from './categoryOverlay.ts'

// Портировано без изменений из `pages/ServicesReport/ui/CategoryTreeSelect/ui/CategorySearchInput.tsx`
// (openspec/changes/service-turnover-report, задача 17) — чисто презентационный компонент, не
// завязан на форму категории (строка поиска — уже готовый `string`), адаптировать нечего.

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
