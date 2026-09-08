import { Loader2 } from 'lucide-react'

import type { MotivationSchemaListItem } from '../model/types.ts'

import { EmptyStateNoResults } from './EmptyStateNoResults.tsx'
import { EmptyStateNoSchemas } from './EmptyStateNoSchemas.tsx'
import { SchemaGrid } from './SchemaGrid.tsx'
import { SchemaListMobile } from './SchemaListMobile.tsx'

export type SchemaListBodyProps = {
    isLoading: boolean
    errorMessage: string | null
    isEmpty: boolean
    isFilteredEmpty: boolean
    schemas: MotivationSchemaListItem[]
    totalCount: number
    onResetFilters: () => void
    className?: string
}

/**
 * The one presentational component allowed to branch on what to render (frontend/CLAUDE.md's
 * mediator convention — `SalaryRuleListPage` itself stays a plain composition, no `&&`/ternary).
 * Order: loading spinner -> error message -> "no schemas at all" (`EmptyStateNoSchemas`) -> "filters
 * matched nothing" (`EmptyStateNoResults`) -> the real grid/list, rendered as both `SchemaGrid`
 * (`md:` and up) and `SchemaListMobile` (below `md:`) side by side, switching purely on Tailwind
 * responsive utilities like the rest of the app's dual desktop/mobile layouts.
 */
function SchemaListBody({
    isLoading,
    errorMessage,
    isEmpty,
    isFilteredEmpty,
    schemas,
    totalCount,
    onResetFilters,
    className,
}: SchemaListBodyProps) {
    if (isLoading) {
        return (
            <div className={className}>
                <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-hairline bg-surface">
                    <Loader2 className="size-6 animate-spin text-ink-faint" />
                </div>
            </div>
        )
    }

    if (errorMessage) {
        return (
            <div className={className}>
                <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-hairline bg-surface px-6 text-center font-ui text-sm text-danger">
                    {errorMessage}
                </div>
            </div>
        )
    }

    if (isEmpty) return <EmptyStateNoSchemas className={className} />

    if (isFilteredEmpty) return <EmptyStateNoResults onResetFilters={onResetFilters} className={className} />

    return (
        <div className={className}>
            <SchemaGrid schemas={schemas} className="hidden md:block" />
            <SchemaListMobile schemas={schemas} totalCount={totalCount} className="md:hidden" />
        </div>
    )
}

export { SchemaListBody }
