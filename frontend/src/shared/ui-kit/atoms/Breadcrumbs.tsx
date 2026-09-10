import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/shared/lib/tw'

export type BreadcrumbItem = {
    label: string
    /** Путь для `Link`. Пункт без `to` (обычно последний, текущая страница) рендерится как
     * обычный текст, а не ссылка. */
    to?: string
}

export type BreadcrumbsProps = {
    items: BreadcrumbItem[]
    className?: string
}

/**
 * Строка хлебных крошек (`ERP/Organism/Page Header`'s `Breadcrumbs`, см.
 * `shared/ui-kit/organisms/PageHeader.tsx`) — десктоп-онли (`hidden md:flex`), 12px `ink-muted`
 * ссылки на предков + `ChevronRight`-разделитель + текущий, некликабельный пункт (`ink`,
 * 500-weight). Общий, т.к. используется и внутри `PageHeader`, и напрямую на страницах со своей
 * собственной шапкой (`pages/SalaryRuleDetail`, `pages/EmployeeBalance`).
 */
function Breadcrumbs({ items, className }: BreadcrumbsProps) {
    return (
        <div data-slot="breadcrumbs" className={cn('hidden min-w-0 items-center gap-1.5 md:flex', className)}>
            {items.map((item, index) => {
                const isLast = index === items.length - 1

                return (
                    <span key={item.label} className="flex min-w-0 items-center gap-1.5">
                        {item.to ? (
                            <Link
                                to={item.to}
                                className="truncate font-ui text-xs text-ink-muted transition-colors hover:text-ink"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span
                                className={cn(
                                    'truncate font-ui text-xs',
                                    isLast ? 'font-medium text-ink' : 'text-ink-muted',
                                )}
                            >
                                {item.label}
                            </span>
                        )}
                        {!isLast && <ChevronRight className="size-3 shrink-0 text-ink-faint" />}
                    </span>
                )
            })}
        </div>
    )
}

export { Breadcrumbs }
