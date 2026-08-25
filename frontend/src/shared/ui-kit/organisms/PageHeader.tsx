import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `e84ap` (`ERP/Organism/Page Header`) — a
 * reusable header instanced across the app's list-style pages (confirmed via `Get`: e.g. `FXsB3` on
 * `pages/SalaryRuleList`'s desktop screen, plus another instance on `pages/SalesPlan`'s own mockup
 * frame). Vertical stack, 12px gap: a small `Breadcrumbs` row (12px `ink-muted` crumb + a
 * chevron-right separator + a 500-weight `ink` current crumb), then a `Main` row
 * (`justify-content: space-between`) pairing a `Title Block` (font-display 20/700, -0.3 tracking +
 * a 13px `ink-muted` subtitle) with an `Actions` slot (optional secondary + primary buttons).
 *
 * `pages/SalesPlan/ui/PageHeader.tsx` is a different, page-local component built around that page's
 * own direction/period controls — this one is the generic, slots-based organism for pages that just
 * need "breadcrumb + title/subtitle + up to two actions" (frontend/CLAUDE.md's "Слоты вместо
 * children": `actions` is a `ReactNode` slot, not a fixed button API, so callers stay free to pass
 * one button, two, or none).
 *
 * The `Breadcrumbs` row is desktop-only (`hidden md:flex`) — on mobile, `app/Header.tsx`'s own
 * `HeaderMobile` sticky bar already renders the same "Section / Page" breadcrumb (see its `mobile`
 * prop), so repeating it here would be redundant; mobile screens in the mockup (`qJ0qx`'s
 * `j3cLAi`) indeed omit this row entirely.
 */
export type PageHeaderBreadcrumb = {
    label: string
    to?: string
}

export type PageHeaderProps = {
    breadcrumbs: PageHeaderBreadcrumb[]
    /** Обычно строка, но принимает любой `ReactNode` — например, чтобы заменить заголовок на
     * составной блок (аватар + имя + мета), как в `pages/SalaryReportV2/ui/SalaryReportHeading.tsx`
     * для отчёта конкретного сотрудника (тот же слот, что и обычный текстовый `<h1>`, просто с
     * более сложным содержимым). */
    title: ReactNode
    subtitle?: string
    /** Secondary + primary action buttons, rendered as-is (0-2 typical, per the mockup's `RL69s`
     * "Actions" frame). Omit for no action row. */
    actions?: ReactNode
    className?: string
}

function PageHeader({ breadcrumbs, title, subtitle, actions, className }: PageHeaderProps) {
    return (
        <div data-slot="page-header" className={cn('flex flex-col gap-3', className)}>
            {breadcrumbs.length > 0 && (
                <div className="hidden items-center gap-1.5 md:flex">
                    {breadcrumbs.map((crumb, index) => {
                        const isLast = index === breadcrumbs.length - 1
                        return (
                            <span key={crumb.label} className="flex items-center gap-1.5">
                                {index > 0 && <ChevronRight className="size-3 shrink-0 text-ink-faint" />}
                                <span
                                    className={cn(
                                        'font-ui text-xs',
                                        isLast ? 'font-medium text-ink' : 'text-ink-muted',
                                    )}
                                >
                                    {crumb.label}
                                </span>
                            </span>
                        )
                    })}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-[20px] font-bold tracking-[-0.3px] text-ink">{title}</h1>
                    {subtitle && <p className="font-ui text-[13px] text-ink-muted">{subtitle}</p>}
                </div>

                {actions && (
                    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 md:w-auto">{actions}</div>
                )}
            </div>
        </div>
    )
}

export { PageHeader }
