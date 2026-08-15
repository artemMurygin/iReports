import { CalendarX2 } from 'lucide-react'

import { cn } from '@/shared/lib/tw'

export type SalesPlanEmptyStateProps = {
    periodLabel: string
    className?: string
}

/**
 * Тестовые данные `salesPerformance` гарантированно есть только за `2026-06` — для любого
 * другого периода (или направления, которое ещё не синхронизировано) бэкенд отдаёт пустой
 * массив (см. Фазу 5 в docs/sales-plan-view-page/plan-sales-plan-view-page.md). Дизайн
 * (`design/sallary-first-iteration.pen`) не описывает отдельный empty-state узел — карточка
 * оформлена в токенах существующего UI Kit (`hairline`/`surface`/`ink-muted`) и заменяет собой
 * и `SalesPlanTable`, и `SalesPlanCardList` одним и тем же блоком на обоих брейкпоинтах.
 */
function SalesPlanEmptyState({ periodLabel, className }: SalesPlanEmptyStateProps) {
    return (
        <div
            data-slot="sales-plan-empty-state"
            className={cn(
                'flex flex-col items-center gap-3 rounded-xl border border-hairline bg-surface px-6 py-16 text-center',
                className,
            )}
        >
            <span className="flex size-11 items-center justify-center rounded-full bg-hairline text-ink-muted">
                <CalendarX2 className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
                <p className="font-ui text-sm font-semibold text-ink">Нет данных плана продаж за {periodLabel}</p>
                <p className="max-w-sm font-ui text-xs text-ink-muted">
                    Попробуйте другой период или направление — тестовые данные гарантированно доступны только за июнь 2026.
                </p>
            </div>
        </div>
    )
}

export { SalesPlanEmptyState }
