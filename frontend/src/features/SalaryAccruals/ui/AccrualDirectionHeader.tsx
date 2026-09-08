import { ShoppingBag, Wrench } from 'lucide-react'
import type { SalesDirection } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'

export type AccrualDirectionHeaderProps = {
    direction: SalesDirection
    /** Человекочитаемое название направления («Сервис»/«Магазин») — фича не может достать его
     * сама (кросс-импорт `features/AccountingPeriod` запрещён линтингом, frontend/CLAUDE.md),
     * поэтому приходит пропом от вызывающей страницы. */
    label: string
    rulesCount: number
    /** Сумма ВСЕХ строк документа по этому направлению — на Фазе 5 документ всегда одно-
     * направленный (`salaryAccrualSchema.direction` — одно значение на документ, контракт не
     * умеет смешивать «Сервис»/«Магазин» строки в одном документе), поэтому вызывающая сторона
     * передаёт сюда `document.total` целиком, а не пересчитывает сумму по строкам. */
    total: number
    className?: string
}

const DIRECTION_ICON: Record<SalesDirection, typeof Wrench> = {
    service: Wrench,
    shop: ShoppingBag,
}

/** Pencil `DQ3tV`'s `xxwir`/`i8t0m9` (десктоп), `g0onp`'s `fYFub`/`tBa1s` (мобильный) — «Сервис»
 * на `brand-*` токенах, «Магазин» на `info-*` (мокап красит иконку/акцент магазина синим
 * `#1D4ED8` = `info-ink`, НЕ фиолетовым `violet-ink`, которым красит его соседняя
 * `pages/SalaryReportV2/ui/LedgerDirectionBlock.tsx` — разные страницы, разные цветовые решения
 * в самом дизайне, перепроверено скриншотом узла). */
const HEADER_CLASS: Record<SalesDirection, string> = {
    service: 'bg-brand-soft border-l-brand-strong',
    shop: 'bg-info-soft border-l-info-ink',
}
const ICON_CLASS: Record<SalesDirection, string> = {
    service: 'text-brand-strong',
    shop: 'text-info-ink',
}

/**
 * Заголовок направления над таблицей/списком строк документа начисления (Pencil `DQ3tV`/`g0onp`):
 * иконка · название · «· N правил» слева, сумма по направлению справа, левый акцент-бордер 4px в
 * цвет направления. В отличие от `LedgerDirectionBlock` (отчёт зарплаты, несколько направлений в
 * одной карточке, сворачиваемый блок) — здесь ровно один инстанс на документ (см. `total`'s
 * комментарий) и без сворачивания: сам заголовок таблицы строк документа, а не аккордеон.
 */
export function AccrualDirectionHeader({ direction, label, rulesCount, total, className }: AccrualDirectionHeaderProps) {
    const Icon = DIRECTION_ICON[direction]

    return (
        <div
            data-slot="accrual-direction-header"
            className={cn(
                'flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-l-4 px-3 py-2.5 md:px-5 md:py-3',
                HEADER_CLASS[direction],
                className,
            )}
        >
            <div className="flex min-w-0 items-center gap-1.5 md:gap-2">
                <Icon className={cn('size-3.5 shrink-0 md:size-4', ICON_CLASS[direction])} />
                <span className="truncate font-display text-[15px] font-bold text-ink md:text-base">{label}</span>
                <span className="shrink-0 font-ui text-xs text-ink-muted">· {pluralizeRules(rulesCount)}</span>
            </div>
            <span className="shrink-0 font-display text-sm font-bold text-ink tabular-nums md:text-base">
                {formatCurrency(total)}
            </span>
        </div>
    )
}
