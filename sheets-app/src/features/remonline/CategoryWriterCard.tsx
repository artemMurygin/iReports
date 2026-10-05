import { CornerDownLeft, GitBranch } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { StatusBanner } from '@/shared/gsheets-ui/StatusBanner'
import type { CategoryTree } from './categoryTree'
import type { CategoryStatus } from './useRemonlineActions'

/** Display-only separator of the path row; the cell itself is written with ' > ' (Q9). */
const PATH_DISPLAY_SEPARATOR = ' / '

interface CategoryWriterCardProps {
    tree: CategoryTree | null
    loadStatus: 'idle' | 'loading' | 'ready' | 'error'
    loadError: string | null
    selection: (number | null)[]
    saveStatus: CategoryStatus | null
    saveBusy: boolean
    canSave: boolean
    disabled?: boolean
    onLevelChange: (level: number, value: string) => void
    onSave: () => void
    onRetryLoad: () => void
}

/**
 * Implements FR8, UX3 of sheets-app-redesign: «Записать категорию в ячейку» card: path row, cascading Selects
 * (names only, no level indices, Q16) and the «Записать категорию» button, active only when a leaf is chosen.
 */
export function CategoryWriterCard({
    tree,
    loadStatus,
    loadError,
    selection,
    saveStatus,
    saveBusy,
    canSave,
    disabled = false,
    onLevelChange,
    onSave,
    onRetryLoad,
}: CategoryWriterCardProps) {
    const pathNames = tree
        ? selection.flatMap((id) => {
              const name = id === null ? undefined : tree.byId.get(id)?.name
              return name ? [name.trim()] : []
          })
        : []

    return (
        <section
            data-testid="ro-category-writer"
            aria-label="Записать категорию в ячейку"
            className="flex flex-col gap-2 rounded-xl border bg-muted p-3"
        >
            {loadStatus === 'loading' || loadStatus === 'idle' ? (
                <p data-testid="ro-category-loading" role="status" className="font-mono text-xs text-muted-foreground">
                    Загрузка категорий...
                </p>
            ) : loadStatus === 'error' || !tree ? (
                <div className="flex flex-col gap-2">
                    <StatusBanner
                        data-testid="ro-category-load-error"
                        title="Не удалось загрузить категории"
                        detail={loadError ?? undefined}
                    />
                    <Button type="button" variant="outline" size="run" onClick={onRetryLoad}>
                        Повторить
                    </Button>
                </div>
            ) : (
                <>
                    <p
                        data-testid="ro-category-path"
                        className="flex items-center gap-2 font-mono text-xs text-muted-foreground"
                    >
                        <GitBranch aria-hidden="true" className="size-3.5 shrink-0" />
                        <span className="truncate">
                            {pathNames.length > 0 ? pathNames.join(PATH_DISPLAY_SEPARATOR) : 'Категория не выбрана'}
                        </span>
                    </p>
                    {selection.map((selectedId, level) => {
                        const parentId = level === 0 ? null : selection[level - 1]
                        const children = (tree.byParent.get(parentId) ?? [])
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
                        return (
                            <Select
                                key={level}
                                value={selectedId === null ? '' : String(selectedId)}
                                disabled={disabled}
                                onValueChange={(value) => onLevelChange(level, value)}
                            >
                                <SelectTrigger
                                    data-testid={`ro-category-select-${level}`}
                                    aria-label={`Категория, уровень ${level + 1}`}
                                >
                                    <SelectValue placeholder="— Выберите услугу" />
                                </SelectTrigger>
                                <SelectContent>
                                    {children.map((category) => (
                                        <SelectItem key={category.id} value={String(category.id)}>
                                            {category.name.trim()}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )
                    })}
                    <Button
                        data-testid="ro-save-category"
                        variant="ink"
                        block
                        disabled={disabled || saveBusy || !canSave}
                        onClick={onSave}
                    >
                        <CornerDownLeft />
                        {saveBusy ? 'Запись...' : 'Записать категорию'}
                    </Button>
                    {saveStatus && (
                        <StatusBanner
                            data-testid="ro-category-status"
                            variant={saveStatus.variant === 'error' ? 'error' : 'warning'}
                            title={saveStatus.message}
                            className={
                                saveStatus.variant === 'success'
                                    ? 'border-brand-border bg-brand-soft text-ok-ink'
                                    : undefined
                            }
                        />
                    )}
                </>
            )}
        </section>
    )
}
