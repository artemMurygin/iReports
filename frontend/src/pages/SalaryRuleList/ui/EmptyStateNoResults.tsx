import { SearchX } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'

export type EmptyStateNoResultsProps = {
    onResetFilters: () => void
    className?: string
}

/**
 * Not present in `design/sallary-first-iteration.pen` — the two mockup frames (`zXpmh`/`qJ0qx`)
 * only show a fully-populated list and the "no schemas at all" empty state (`UlVij`), with no
 * "filters produced zero results" screenshot. The PRD (docs/salary-schema-list-ui) still requires
 * this case, so it's built as `EmptyStateNoSchemas`'s sibling: same card shell/typography scale,
 * swapping the icon (`SearchX` instead of `BadgePercent`), copy, and the CTA (a filter-reset action
 * instead of a creation link, since there's nothing to create here).
 */
function EmptyStateNoResults({ onResetFilters, className }: EmptyStateNoResultsProps) {
    return (
        <div data-slot="empty-state-no-results" className={className}>
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-hairline bg-surface px-6 py-16 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-canvas">
                    <SearchX className="size-7 text-ink-muted" />
                </div>

                <div className="flex flex-col items-center gap-2">
                    <h2 className="font-display text-lg font-bold tracking-[-0.2px] text-ink">Ничего не найдено</h2>
                    <p className="max-w-[420px] font-ui text-[13px] leading-[1.5] text-ink-muted">
                        По заданным фильтрам ни одна схема не найдена. Попробуйте изменить условия поиска или сбросить
                        фильтры.
                    </p>
                </div>

                <Button type="button" variant="secondary" onClick={onResetFilters}>
                    Сбросить фильтры
                </Button>
            </div>
        </div>
    )
}

export { EmptyStateNoResults }
