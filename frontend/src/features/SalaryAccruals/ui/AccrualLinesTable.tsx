import { ChevronDown, MessageSquareText, UserRound } from 'lucide-react'
import type { SalaryAccrualLine, SalaryAccrualStatus, SalesDirection } from 'ireports-contracts'

import { ALL_RULE_TYPE_LABELS } from '@/kernel/ruleTypeLabels.ts'
import { formatCurrency, formatNumber } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Chip } from '@/shared/ui-kit/atoms/Chip'

import { formatLineRate, isLineAdjusted } from '../model/accrualView.ts'
import { getSalaryBasisLabel, ROLE_LABEL } from '../model/labels.ts'

import { AccrualLineActions } from './AccrualLineActions.tsx'
import { AccrualLineSources } from './AccrualLineSources.tsx'
import { AccrualLineStatusBadge } from './AccrualStatusBadge.tsx'

const COLUMNS = 'grid-cols-[36px_minmax(220px,1fr)_170px_150px_100px_110px_150px_120px_200px]'

function getRuleTypeLabel(type: string): string {
    return (ALL_RULE_TYPE_LABELS as Record<string, string>)[type] ?? type
}

/**
 * Pencil `jb7fL` (`Начисление · Документ`, таблица строк по правилам): экспандер ·
 * Правило (название + тип мелким) · Роль (чип) · База · Кол-во · Ставка · Сумма, ₽
 * (при корректировке исходная сумма зачёркнута + иконка комментария) · Статус строки ·
 * Действия (Фаза 9, PRD 2 — `AccrualLineActions`: «Начислить» + карандаш «Корректировать»
 * для `DRAFT`, «Отменить начисление» для `ACCRUED`; ячейка пустая, если документ уже
 * `PAID` — все действия скрыты целиком, действие завершено). Строка раскрывается
 * аккордеоном в источники (`AccrualLineSources`).
 */
export type AccrualLinesTableProps = {
    lines: SalaryAccrualLine[]
    direction: SalesDirection
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
    accrualId,
    documentStatus,
    isLineExpanded,
    onToggleLine,
    footerNote,
    footerTotal,
    className,
}: AccrualLinesTableProps) {
    const actionsVisible = documentStatus !== 'PAID'
    return (
        <div
            data-slot="accrual-lines-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div className="min-w-[1256px]">
                    <div
                        className={cn(
                            'grid items-center gap-2 border-b border-hairline bg-canvas px-3 py-2.5',
                            COLUMNS,
                        )}
                    >
                        <span />
                        <span className="font-ui text-xs font-semibold text-ink">Правило</span>
                        <span className="font-ui text-xs font-medium text-ink-muted">Роль</span>
                        <span className="font-ui text-xs font-medium text-ink-muted">База</span>
                        <span className="text-right font-ui text-xs font-medium text-ink-muted">Кол-во</span>
                        <span className="text-right font-ui text-xs font-medium text-ink-muted">Ставка</span>
                        <span className="text-right font-ui text-xs font-semibold text-ink">Сумма, ₽</span>
                        <span className="font-ui text-xs font-medium text-ink-muted">Статус строки</span>
                        <span className="text-right font-ui text-xs font-medium text-ink-muted">Действия</span>
                    </div>

                    {lines.map((line, index) => {
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
                                        'grid w-full cursor-pointer items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-canvas',
                                        COLUMNS,
                                    )}
                                >
                                    <ChevronDown
                                        className={cn(
                                            'size-4 shrink-0 text-ink-muted transition-transform duration-150',
                                            expanded && 'rotate-180',
                                        )}
                                    />
                                    <span className="flex min-w-0 flex-col">
                                        <span className="truncate font-ui text-[13px] font-semibold text-ink">
                                            {line.name}
                                        </span>
                                        <span className="truncate font-ui text-[11px] text-ink-muted">
                                            {getRuleTypeLabel(line.type)}
                                        </span>
                                    </span>
                                    <span className="min-w-0">
                                        <Chip icon={<UserRound />}>{ROLE_LABEL[line.targetRole]}</Chip>
                                    </span>
                                    <span className="truncate font-ui text-[13px] text-ink-muted">
                                        {getSalaryBasisLabel(line.salaryBasis)}
                                    </span>
                                    <span className="text-right font-ui text-[13px] font-medium text-ink tabular-nums">
                                        {line.quantity === undefined ? '—' : formatNumber(line.quantity)}
                                    </span>
                                    <span className="text-right font-ui text-[13px] font-medium text-ink tabular-nums">
                                        {formatLineRate(line)}
                                    </span>
                                    <span className="flex items-center justify-end gap-1.5 text-right">
                                        {adjusted && (
                                            <>
                                                <span className="font-ui text-xs text-ink-faint line-through tabular-nums">
                                                    {formatCurrency(line.originalAmount)}
                                                </span>
                                                <MessageSquareText
                                                    aria-label="Строка скорректирована"
                                                    className="size-3.5 shrink-0 text-warn-ink"
                                                />
                                            </>
                                        )}
                                        <span className="font-ui text-sm font-bold text-ink tabular-nums">
                                            {formatCurrency(line.amount)}
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
                                            <AccrualLineActions
                                                line={line}
                                                direction={direction}
                                                accrualId={accrualId}
                                            />
                                        )}
                                    </span>
                                </div>

                                {expanded && (
                                    <AccrualLineSources
                                        sources={line.sources}
                                        className="border-t border-hairline bg-canvas"
                                    />
                                )}
                            </div>
                        )
                    })}

                    <div className="flex items-center justify-between gap-4 border-t border-hairline bg-canvas px-4 py-3">
                        <span className="truncate font-ui text-xs text-ink-muted">{footerNote}</span>
                        <span className="shrink-0 font-ui text-[13px] font-bold text-ink tabular-nums">
                            {footerTotal}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export { AccrualLinesTable }
