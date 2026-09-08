import { cn } from '@/shared/lib/tw'

export type IdentityEmptyStateProps = {
    title: string
    description: string
    className?: string
}

/**
 * Пустое состояние таблицы связей. Отдельного макета у него нет (в Pencil таблица всегда с
 * данными), поэтому свёрстано по общему для проекта паттерну карточки-заглушки: тот же
 * контейнер `rounded-xl border-hairline bg-surface`, что и у таблицы, с центрированным
 * текстом. Два разных случая — «сотрудников нет вовсе» и «под фильтры ничего не подошло» —
 * различаются только текстом, поэтому он приходит пропсами.
 */
function IdentityEmptyState({ title, description, className }: IdentityEmptyStateProps) {
    return (
        <div
            data-slot="identity-empty-state"
            className={cn('rounded-xl border border-hairline bg-surface px-6 py-10 text-center', className)}
        >
            <p className="font-display text-sm font-bold text-ink">{title}</p>
            <p className="mt-1.5 font-ui text-sm text-ink-muted">{description}</p>
        </div>
    )
}

export { IdentityEmptyState }
