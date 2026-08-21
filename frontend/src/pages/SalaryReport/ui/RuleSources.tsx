import { useState } from 'react'
import { ChevronsDown, CornerDownRight, Receipt } from 'lucide-react'

import { cn } from '@/shared/lib/tw'

import type { SalaryReportRule } from '../model/types.ts'

export type RuleSourcesProps = {
    sources: SalaryReportRule['sources']
    className?: string
}

const DEFAULT_VISIBLE_COUNT = 3

/** Человекочитаемые подписи для `source.type` — реальные значения, которые кладёт бэкенд в
 * `sources[]` каждого зарплатного правила (см. `rule-breakdown.builder.ts` + сущности правил на
 * обоих направлениях: `order-payed.entity.ts` -> `'order'`, `service-completed.entity.ts` ->
 * `'serviceOrderItem'`, `task-completed.entity.ts` (оба направления) -> `'taskCompletion'`,
 * `product-sold.entity.ts`/`used-product-sold.entity.ts` -> `'demandPosition'`). Свободная
 * `z.string()` в контракте (`calculationSourceRefSchema`), поэтому с fallback на сырое значение. */
const SOURCE_TYPE_LABELS: Record<string, string> = {
    order: 'Заказ',
    serviceOrderItem: 'Позиция услуги',
    taskCompletion: 'Задача',
    demandPosition: 'Позиция отгрузки',
}

function getSourceLabel(type: string): string {
    return SOURCE_TYPE_LABELS[type] ?? type
}

/**
 * Разворот правила в заказы (Pencil: `t3QCM`'s `Expansion · Заказы` / `Z0lgF`'s одноимённый
 * блок) — заголовки мокапа обещают богатую подтаблицу («Документ», «Устройство / работа»,
 * «Факт, ₽», «Прогноз, ₽» на каждый заказ). Реальный контракт этого не отдаёт:
 * `employeeSalaryReportRuleSchema.sources` — это `calculationSourceRefSchema[]`, то есть просто
 * `{ type, id }` на источник, БЕЗ номера документа, описания устройства/работы и БЕЗ отдельных
 * факт/прогноз-сумм на строку (см. `rule-breakdown.builder.ts` на обоих направлениях —
 * `sources.push({ type, id })`, никакой суммы или названия рядом). Поэтому этот компонент — не
 * "Sub Table" 1:1 с мокапом, а честная витрина того, что реально есть: человекочитаемый тип
 * источника + его id. Пиксель-точная разбивка (документ/описание/суммы по заказу) потребует
 * обогащения `sources[]` на бэкенде — это не тот случай, где стоит что-то придумывать на фронте.
 */
export function RuleSources({ sources, className }: RuleSourcesProps) {
    const [showAll, setShowAll] = useState(false)

    if (sources.length === 0) {
        return (
            <div className={cn('flex items-center gap-2 py-2.5 pl-9 font-ui text-xs text-ink-muted', className)}>
                <CornerDownRight className="size-3.5 shrink-0 text-ink-faint" />
                Нет связанных заказов
            </div>
        )
    }

    const visible = showAll ? sources : sources.slice(0, DEFAULT_VISIBLE_COUNT)
    const hasMore = visible.length < sources.length

    return (
        <div data-slot="rule-sources" className={cn('flex flex-col gap-1.5 py-2.5 pr-3 pl-9', className)}>
            {visible.map((source, index) => (
                <div
                    key={`${source.type}-${source.id}-${index}`}
                    className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 font-ui text-xs"
                >
                    <Receipt className="size-3.5 shrink-0 text-ink-faint" />
                    <span className="font-medium text-ink">{getSourceLabel(source.type)}</span>
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
                    Показать все заказы ({sources.length})
                </button>
            )}
        </div>
    )
}
