import { BadgePercent, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/shared/ui-kit/atoms/Button'

export type EmptyStateNoSchemasProps = {
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `UlVij`/`P9g6c` (`Правила начисления · Пустое
 * состояние`, `Empty State`) — surface card, 12px radius, hairline border, centered content: a 64px
 * `brand-soft` icon circle (`badge-percent`, `ok-ink`), a font-display 18/700 title, a centered
 * 13px `ink-muted` description (max ~420px), the "Создать схему" CTA (`nGjdo`), and a 12px
 * `ink-faint` hint line. Shown when the unfiltered schema list is empty — the "no results after
 * filtering" case is `EmptyStateNoResults`, a sibling with a different icon/copy/action.
 */
function EmptyStateNoSchemas({ className }: EmptyStateNoSchemasProps) {
    return (
        <div data-slot="empty-state-no-schemas" className={className}>
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-hairline bg-surface px-6 py-16 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-brand-soft">
                    <BadgePercent className="size-7 text-ok-ink" />
                </div>

                <div className="flex flex-col items-center gap-2">
                    <h2 className="font-display text-lg font-bold tracking-[-0.2px] text-ink">Схем ещё нет</h2>
                    <p className="max-w-[420px] font-ui text-[13px] leading-[1.5] text-ink-muted">
                        Создайте первую мотивационную схему: выберите отдел или сотрудника и добавьте правила начисления
                        — почасовую оплату, услуги, заказы или задачи.
                    </p>
                </div>

                <Button asChild>
                    <Link to="/salaries/rules/new">
                        <Plus />
                        Создать схему
                    </Link>
                </Button>

                <p className="font-ui text-xs text-ink-faint">Схема появится в этом списке сразу после сохранения</p>
            </div>
        </div>
    )
}

export { EmptyStateNoSchemas }
