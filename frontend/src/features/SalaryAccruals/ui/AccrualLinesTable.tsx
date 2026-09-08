import { ChevronDown, UserRound } from 'lucide-react'
import type { SalaryAccrualLine, SalaryAccrualStatus, SalesDirection } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Chip } from '@/shared/ui-kit/atoms/Chip'

import { formatLineBasisNote, formatLineMeta, isLineAdjusted } from '../model/accrualView.ts'
import { ROLE_LABEL } from '../model/labels.ts'

import { AccrualDirectionHeader } from './AccrualDirectionHeader.tsx'
import { AccrualLineActions } from './AccrualLineActions.tsx'
import { AccrualLineSources } from './AccrualLineSources.tsx'
import { AdjustmentBadge, AccrualLineStatusBadge } from './AccrualStatusBadge.tsx'

const COLUMNS = 'grid-cols-[minmax(240px,1fr)_160px_130px_200px_20px]'

const DOT_CLASS: Record<SalesDirection, string> = {
    service: 'bg-brand-strong',
    shop: 'bg-info-ink',
}

/**
 * Pencil `DQ3tV` (`Начисление · Документ` redesign, десктоп) — карточка-гроссбух документа:
 * `AccrualDirectionHeader` (документ Фазы 5 всегда одно-направленный, см. её комментарий) сверху,
 * затем заголовок колонок «Правило начисления / Сумма, ₽ / Статус / Действия», затем строки —
 * название правила + чип роли (+ `AdjustmentBadge`, если строка скорректирована) + мета
 * (`formatLineMeta`), сумма с «Было: X ₽» зачёркнутым при корректировке и «Основанием»
 * (`formatLineBasisNote`) под ней, статус-бейдж, действия (Фаза 9 — `AccrualLineActions`).
 * Хвостовой узкий столбец шеврона — добавление сверх макета (тот же приём и то же обоснование,
 * что и `LEDGER_CHEVRON_COL` в `pages/SalaryReportV2/ui/LedgerRuleRow.tsx`: мокап не рисует явный
 * аффорданс разворота, но `onToggleLine` должен быть заметен). Строка раскрывается аккордеоном в
 * источники (`AccrualLineSources`).
 */
export type AccrualLinesTableProps = {
    lines: SalaryAccrualLine[]
    direction: SalesDirection
    directionLabel: string
    accrualId: string
    /** Статус ДОКУМЕНТА (не строки) — только он решает видимость колонки «Действия». */
    documentStatus: SalaryAccrualStatus
    isLineExpanded: (id: string) => boolean
    onToggleLine: (id: string) => void
    /** «5 строк · начислено 0 из 5 · корректировок: 1» — подвал таблицы. */
    footerNote: string
    /** «Итого 68 400 ₽». */
    footerTotal: string
    className?: string
}

function AccrualLinesTable({
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
}: AccrualLinesTableProps) {
    const actionsVisible = documentStatus !== 'PAID'
    const total = lines.reduce((sum, line) => sum + line.amount, 0)

    return (
        <div
            data-slot="accrual-lines-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <AccrualDirectionHeader direction={direction} label={directionLabel} rulesCount={lines.length} total={total} />

            <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                    <div
                        className={cn(
                            'grid items-center gap-3 border-b border-hairline bg-canvas px-5 py-2.5',
                            COLUMNS,
                        )}
                    >
                        <span className="font-ui text-xs font-semibold text-ink">Правило начисления</span>
                        <span className="text-right font-ui text-xs font-semibold text-ink">Сумма, ₽</span>
                        <span className="font-ui text-xs font-medium text-ink-muted">Статус</span>
                        <span className="text-right font-ui text-xs font-medium text-ink-muted">Действия</span>
                        <span />
                    </div>

                    {lines.length === 0 ? (
                        <p className="px-5 py-6 text-center font-ui text-xs text-ink-muted">
                            В документе нет строк по правилам.
                        </p>
                    ) : (
                        lines.map((line, index) => {
                            const expanded = isLineExpanded(line.id)
                            const adjusted = isLineAdjusted(line)

                            return (
                                <div
                                    key={line.id}
                                    className={cn(index > 0 && 'border-t border-hairline', expanded && 'bg-row-selected')}
                                >
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
                                        className={cn(
                                            'grid w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-canvas',
                                            COLUMNS,
                                        )}
                                    >
                                        <span className="flex min-w-0 flex-col gap-0.5">
                                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                                                <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[direction])} aria-hidden />
                                                <span className="truncate font-ui text-[13px] font-semibold text-ink">{line.name}</span>
                                                <Chip icon={<UserRound />}>{ROLE_LABEL[line.targetRole]}</Chip>
                                                {adjusted && <AdjustmentBadge />}
                                            </span>
                                            <span className="truncate font-ui text-[11px] text-ink-muted">{formatLineMeta(line)}</span>
                                        </span>

                                        <span className="flex flex-col items-end gap-0.5">
                                            {adjusted && (
                                                <span className="font-ui text-[11px] text-ink-faint line-through tabular-nums">
                                                    Было: {formatCurrency(line.originalAmount)}
                                                </span>
                                            )}
                                            <span className="font-ui text-sm font-bold text-ink tabular-nums">
                                                {formatCurrency(line.amount)}
                                            </span>
                                            <span className="text-right font-ui text-[11px] text-ink-muted tabular-nums">
                                                {formatLineBasisNote(line)}
                                            </span>
                                        </span>

                                        <span>
                                            <AccrualLineStatusBadge status={line.status} />
                                        </span>

                                        <span
                                            className="flex items-center justify-end gap-1.5"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            {actionsVisible && (
                                                <AccrualLineActions line={line} direction={direction} accrualId={accrualId} />
                                            )}
                                        </span>

                                        <span className="flex justify-end">
                                            <ChevronDown
                                                className={cn(
                                                    'size-4 shrink-0 text-ink-muted transition-transform duration-150',
                                                    expanded && 'rotate-180',
                                                )}
                                            />
                                        </span>
                                    </div>

                                    {expanded && (
                                        <AccrualLineSources sources={line.sources} className="border-t border-hairline bg-canvas" />
                                    )}
                                </div>
                            )
                        })
                    )}

                    <div className="flex items-center justify-between gap-4 border-t border-hairline bg-canvas px-5 py-3">
                        <span className="truncate font-ui text-xs text-ink-muted">{footerNote}</span>
                        <span className="shrink-0 font-ui text-[13px] font-bold text-ink tabular-nums">{footerTotal}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export { AccrualLinesTable }
