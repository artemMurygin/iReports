import { ChevronDown, UserRound } from 'lucide-react'
import type { SalaryAccrualLine, SalaryAccrualStatus, SalesDirection } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Chip } from '@/shared/ui-kit/atoms/Chip'

import { formatLineAdjustmentNote, formatLineBasisNote, formatLineMeta, isLineAdjusted } from '../model/accrualView.ts'
import { ROLE_LABEL } from '../model/labels.ts'

import { AccrualDirectionHeader } from './AccrualDirectionHeader.tsx'
import { AccrualLineActions } from './AccrualLineActions.tsx'
import { AccrualLineSources } from './AccrualLineSources.tsx'
import { AccrualLineStatusBadge } from './AccrualStatusBadge.tsx'

const DOT_CLASS: Record<SalesDirection, string> = {
    service: 'bg-brand-strong',
    shop: 'bg-info-ink',
}

/**
 * Pencil `g0onp` (`Начисление · Документ` redesign, мобильный) — тот же «гроссбух», что
 * `AccrualLinesTable` на десктопе, но карточками: `AccrualDirectionHeader` сверху, заголовок
 * колонок «Правило начисления / Сумма, ₽», затем строки-карточки («Верх» — название+чип роли+мета
 * / сумма с «Было» и «Основанием», «Низ» — статус-бейдж+действия) и общий подвал таблицы. В отличие
 * от десктопа, здесь нет отдельного `AdjustmentBadge`/зачёркнутой суммы+бейджа рядом — мокап
 * (`h8et8b`) дописывает корректировку в мету строки («· корректировка +700 ₽»,
 * `formatLineAdjustmentNote`) и показывает «Было» просто приглушённым текстом без зачёркивания.
 * Аккордеон источников (`AccrualLineSources` `compact`) разворачивается по клику на всю строку —
 * явного шеврона-аффорданса в макете нет ни у одной строки (мокап рисует «Детализация» готово
 * развёрнутой только для примера), поэтому здесь, как и в `AccrualLinesTable`'s хвостовом столбце,
 * добавлен декоративный шеврон в конце «Низ»-строки — тот же документированный приём, что и там.
 */
export type AccrualLineCardListProps = {
    lines: SalaryAccrualLine[]
    direction: SalesDirection
    directionLabel: string
    accrualId: string
    /** Статус ДОКУМЕНТА (не строки) — только он решает видимость действий строки. */
    documentStatus: SalaryAccrualStatus
    isLineExpanded: (id: string) => boolean
    onToggleLine: (id: string) => void
    /** «5 строк · корректировок: 1» — подвал таблицы. */
    footerNote: string
    /** «Итого 68 400 ₽». */
    footerTotal: string
    className?: string
}

function AccrualLineCardList({
    lines,
    direction,
    directionLabel,
    accrualId,
    documentStatus,
    isLineExpanded,
    onToggleLine,
    footerNote,
    footerTotal,
    className,
}: AccrualLineCardListProps) {
    const actionsVisible = documentStatus !== 'PAID'
    const total = lines.reduce((sum, line) => sum + line.amount, 0)

    return (
        <div
            data-slot="accrual-line-card-list"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <AccrualDirectionHeader direction={direction} label={directionLabel} rulesCount={lines.length} total={total} />

            <div className="flex items-center gap-2 border-b border-hairline bg-canvas px-3 py-2">
                <span className="min-w-0 flex-1 font-ui text-[11px] font-semibold text-ink">Правило начисления</span>
                <span className="w-[92px] shrink-0 text-right font-ui text-[11px] font-semibold text-ink">Сумма, ₽</span>
            </div>

            {lines.length === 0 ? (
                <p className="px-3 py-6 text-center font-ui text-xs text-ink-muted">В документе нет строк по правилам.</p>
            ) : (
                lines.map((line, index) => {
                    const expanded = isLineExpanded(line.id)
                    const adjusted = isLineAdjusted(line)
                    const meta = adjusted
                        ? `${formatLineMeta(line)} · ${formatLineAdjustmentNote(line)}`
                        : formatLineMeta(line)

                    return (
                        <div key={line.id} className={cn(index > 0 && 'border-t border-hairline', expanded && 'bg-row-selected')}>
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => onToggleLine(line.id)}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter' && event.key !== ' ') return
                                    event.preventDefault()
                                    onToggleLine(line.id)
                                }}
                                aria-expanded={expanded}
                                className="flex cursor-pointer flex-col gap-2 p-3 text-left transition-colors hover:bg-canvas"
                            >
                                <span className="flex w-full items-start gap-2">
                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="flex min-w-0 items-center gap-1.5">
                                            <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[direction])} aria-hidden />
                                            <span className="min-w-0 flex-1 truncate font-ui text-[13px] font-semibold text-ink">
                                                {line.name}
                                            </span>
                                        </span>
                                        <span className="truncate font-ui text-[11px] text-ink-muted">{meta}</span>
                                    </span>
                                    <span className="flex w-[92px] shrink-0 flex-col items-end gap-0.5">
                                        {adjusted && (
                                            <span className="font-ui text-[10.5px] text-ink-faint tabular-nums">
                                                {formatCurrency(line.originalAmount)}
                                            </span>
                                        )}
                                        <span className="font-ui text-sm font-bold text-ink tabular-nums">
                                            {formatCurrency(line.amount)}
                                        </span>
                                        <span className="text-right font-ui text-[10.5px] text-ink-muted tabular-nums">
                                            {formatLineBasisNote(line)}
                                        </span>
                                    </span>
                                </span>

                                <span className="flex items-center gap-1.5">
                                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                                        <Chip icon={<UserRound />}>{ROLE_LABEL[line.targetRole]}</Chip>
                                        <AccrualLineStatusBadge status={line.status} />
                                    </span>
                                    {actionsVisible && (
                                        <span
                                            className="flex shrink-0 items-center gap-1.5"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            <AccrualLineActions line={line} direction={direction} accrualId={accrualId} />
                                        </span>
                                    )}
                                    <ChevronDown
                                        className={cn(
                                            'size-4 shrink-0 text-ink-muted transition-transform duration-150',
                                            expanded && 'rotate-180',
                                        )}
                                    />
                                </span>
                            </div>

                            {expanded && (
                                <AccrualLineSources sources={line.sources} compact className="border-t border-hairline bg-canvas" />
                            )}
                        </div>
                    )
                })
            )}

            <div className="flex items-center justify-between gap-3 border-t border-hairline bg-canvas px-3 py-2.5">
                <span className="truncate font-ui text-[11.5px] text-ink-muted">{footerNote}</span>
                <span className="shrink-0 font-ui text-xs font-semibold text-ink tabular-nums">{footerTotal}</span>
            </div>
        </div>
    )
}

export { AccrualLineCardList }
