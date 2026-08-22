import { ChevronDown, MessageSquareText, UserRound } from 'lucide-react'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { ALL_RULE_TYPE_LABELS } from '@/kernel/ruleTypeLabels.ts'
import { formatCurrency, formatNumber } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Chip } from '@/shared/ui-kit/atoms/Chip'

import { formatLineRate, isLineAdjusted } from '../model/accrualView.ts'
import { getSalaryBasisLabel, ROLE_LABEL } from '../model/labels.ts'

import { AccrualLineSources } from './AccrualLineSources.tsx'
import { AccrualLineStatusBadge } from './AccrualStatusBadge.tsx'

function getRuleTypeLabel(type: string): string {
    return (ALL_RULE_TYPE_LABELS as Record<string, string>)[type] ?? type
}

/**
 * Pencil `wYi5o` (`Начисление · Документ · Мобильный`, «Строки по правилам · N»):
 * карточка строки — название + статус-бейдж, тип мелким, чип роли + «База · Кол-во ×
 * Ставка», сумма крупно (при корректировке исходная зачёркнута + иконка комментария),
 * ссылка «Источники» разворачивает список источников. Кнопки «Начислить»/«Отменить
 * начисление»/карандаш корректировки из мокапа — Фаза 9 (мутации).
 */
export type AccrualLineCardListProps = {
    lines: SalaryAccrualLine[]
    isLineExpanded: (id: string) => boolean
    onToggleLine: (id: string) => void
    /** «Начислено 34 400 ₽ из 68 400 ₽ · корректировок: 1» — подпись под списком. */
    footerNote: string
    className?: string
}

function AccrualLineCardList({ lines, isLineExpanded, onToggleLine, footerNote, className }: AccrualLineCardListProps) {
    return (
        <div data-slot="accrual-line-card-list" className={cn('flex flex-col gap-2.5', className)}>
            <span className="px-0.5 font-ui text-xs font-semibold text-ink">
                Строки по правилам · {lines.length}
            </span>

            {lines.length === 0 ? (
                <div className="rounded-xl border border-hairline bg-surface p-4 text-center">
                    <p className="font-ui text-xs text-ink-muted">В документе нет строк по правилам.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {lines.map((line) => (
                        <AccrualLineCard
                            key={line.id}
                            line={line}
                            expanded={isLineExpanded(line.id)}
                            onToggle={() => onToggleLine(line.id)}
                        />
                    ))}
                </div>
            )}

            <p className="px-0.5 font-ui text-xs text-ink-muted">{footerNote}</p>
        </div>
    )
}

function AccrualLineCard({ line, expanded, onToggle }: { line: SalaryAccrualLine; expanded: boolean; onToggle: () => void }) {
    const adjusted = isLineAdjusted(line)
    const metaParts = [getSalaryBasisLabel(line.salaryBasis)]
    if (line.quantity !== undefined || line.rate !== undefined) {
        metaParts.push(
            `${line.quantity === undefined ? '—' : formatNumber(line.quantity)} × ${formatLineRate(line)}`,
        )
    }

    return (
        <div data-slot="accrual-line-card" className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-3.5 font-ui">
            <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-semibold text-ink">{line.name}</span>
                    <span className="truncate text-xs text-ink-muted">{getRuleTypeLabel(line.type)}</span>
                </div>
                <AccrualLineStatusBadge status={line.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <Chip icon={<UserRound />}>{ROLE_LABEL[line.targetRole]}</Chip>
                <span className="min-w-0 truncate text-xs text-ink-muted">{metaParts.join(' · ')}</span>
            </div>

            <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                    {adjusted && (
                        <>
                            <span className="text-xs text-ink-faint line-through tabular-nums">
                                {formatCurrency(line.originalAmount)}
                            </span>
                            <MessageSquareText aria-label="Строка скорректирована" className="size-3.5 shrink-0 text-warn-ink" />
                        </>
                    )}
                    <span className="truncate font-display text-lg font-bold tracking-[-0.3px] text-ink">
                        {formatCurrency(line.amount)}
                    </span>
                </span>

                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={expanded}
                    className="flex shrink-0 items-center gap-1 text-xs font-semibold text-info-ink"
                >
                    <ChevronDown className={cn('size-3.5 transition-transform duration-150', expanded && 'rotate-180')} />
                    Источники
                </button>
            </div>

            {expanded && <AccrualLineSources sources={line.sources} className="rounded-lg bg-canvas px-0.5" />}
        </div>
    )
}

export { AccrualLineCardList }
