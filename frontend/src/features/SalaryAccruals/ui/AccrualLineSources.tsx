import { useState } from 'react'
import { ChevronsDown, CornerDownRight, ExternalLink, Receipt } from 'lucide-react'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'

import { pluralizeSources } from '../model/accrualView.ts'
import { getSourceTypeLabel } from '../model/labels.ts'

const DEFAULT_VISIBLE_COUNT = 3

/**
 * Разворот строки документа в источники (Pencil `jb7fL`, блок «Источники начисления · 42
 * заказа RemOnline»). На источник заказа (`type: 'order'`/`'serviceOrderItem'`) бэкенд отдаёт
 * человекочитаемый номер заказа RemOnline (`source.label`), ссылку на его карточку
 * (`source.link`) и сумму начисления по этому источнику (`source.amount`) — см.
 * `calculationSourceRefSchema` в `contracts/commands/salary-rule.ts`. Документ начисления
 * фиксирует только факт (без прогноза), поэтому сумма источника здесь — одно число, в отличие
 * от пары факт/прогноз у `pages/SalaryReport/ui/RuleSources.tsx`. Поля опциональны (не у всех
 * типов источника есть документ в ERP, и строки, сохранённые до появления этих полей, их не
 * несут) — при отсутствии строка деградирует к прежнему виду.
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
                    {source.link ? (
                        <a
                            href={source.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-brand-strong hover:underline"
                        >
                            {source.label ?? `#${source.id}`}
                            <ExternalLink className="size-3 shrink-0" />
                        </a>
                    ) : (
                        <span className="text-ink-muted">{source.label ?? `#${source.id}`}</span>
                    )}
                    {source.amount !== undefined && (
                        <span className="ml-auto shrink-0 font-semibold text-ink tabular-nums">
                            {formatCurrency(source.amount)}
                        </span>
                    )}
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
