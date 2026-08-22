import { useState } from 'react'
import { ChevronsDown, CornerDownRight, Receipt } from 'lucide-react'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { pluralizeSources } from '../model/accrualView.ts'
import { getSourceTypeLabel } from '../model/labels.ts'

const DEFAULT_VISIBLE_COUNT = 3

/**
 * Разворот строки документа в источники (Pencil `jb7fL`, блок «Источники начисления · 42
 * заказа RemOnline»). Контракт (`calculationSourceRefSchema`) отдаёт на источник только
 * `{ type, id }` — без даты и суммы, которые обещает мокап, поэтому это «честная витрина»
 * того, что реально есть: человекочитаемый тип + id. Тот же вывод и прецедент, что у
 * pages/SalaryReport/ui/RuleSources.tsx (см. его комментарий): пиксель-точная разбивка
 * потребует обогащения `sources[]` на бэкенде.
 */
export type AccrualLineSourcesProps = {
    sources: SalaryAccrualLine['sources']
    className?: string
}

function AccrualLineSources({ sources, className }: AccrualLineSourcesProps) {
    const [showAll, setShowAll] = useState(false)

    if (sources.length === 0) {
        return (
            <div className={cn('flex items-center gap-2 px-3 py-2.5 font-ui text-xs text-ink-muted', className)}>
                <CornerDownRight className="size-3.5 shrink-0 text-ink-faint" />
                Нет связанных источников
            </div>
        )
    }

    const visible = showAll ? sources : sources.slice(0, DEFAULT_VISIBLE_COUNT)
    const hasMore = visible.length < sources.length

    return (
        <div data-slot="accrual-line-sources" className={cn('flex flex-col gap-1.5 px-3 py-2.5', className)}>
            <span className="font-ui text-xs font-semibold text-ink-muted">Источники начисления · {sources.length}</span>

            {visible.map((source, index) => (
                <div
                    key={`${source.type}-${source.id}-${index}`}
                    className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 font-ui text-xs"
                >
                    <Receipt className="size-3.5 shrink-0 text-ink-faint" />
                    <span className="font-medium text-ink">{getSourceTypeLabel(source.type)}</span>
                    <span className="text-ink-muted">#{source.id}</span>
                </div>
            ))}

            {hasMore && (
                <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    className="flex items-center gap-1.5 pt-1 font-ui text-xs font-semibold text-ink hover:text-brand-strong"
                >
                    <ChevronsDown className="size-3.5" />
                    Показать все {sources.length} {pluralizeSources(sources.length)}
                </button>
            )}
        </div>
    )
}

export { AccrualLineSources }
