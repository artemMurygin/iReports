import { ChevronRight } from 'lucide-react'
import type { SalaryAccrual } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'

import { deriveListProgress, employeeInitials, pluralizeRulesCount } from '../model/accrualView.ts'

import { AccrualProgressBar } from './AccrualProgressBar.tsx'
import { AccrualStatusBadge, DismissedBadge } from './AccrualStatusBadge.tsx'

/**
 * Pencil `Q0i6z3` (`Начисления · Мобильный`, «Документы · N»): карточка документа —
 * аватар + ФИО (+ «Уволен») + «Отдел · N правил» + шеврон, ниже «Сумма» крупно и
 * статус-бейдж с подписью «Начислено N из M», внизу полоса прогресса на всю ширину.
 * Чекбоксы выбора и «Начислить выбранным» из мокапа — Фаза 9 (см. `AccrualsTable`).
 */
export type AccrualCardListProps = {
    items: SalaryAccrual[]
    departmentNameById: Record<number, string>
    onOpenAccrual: (id: string) => void
    /** «Документы · 48» — заголовок списка. */
    headerLabel: string
    /** «Показано N из M документов · …» — подпись под списком. */
    footerNote: string
    className?: string
}

function AccrualCardList({ items, departmentNameById, onOpenAccrual, headerLabel, footerNote, className }: AccrualCardListProps) {
    return (
        <div data-slot="accrual-card-list" className={cn('flex flex-col gap-2.5', className)}>
            <span className="px-0.5 font-ui text-xs font-semibold text-ink">{headerLabel}</span>

            {items.length === 0 ? (
                <div className="rounded-xl border border-hairline bg-surface p-4 text-center">
                    <p className="font-ui text-xs text-ink-muted">Под выбранный фильтр не попал ни один документ.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2.5">
                    {items.map((item) => (
                        <AccrualCard
                            key={item.id}
                            item={item}
                            departmentName={item.departmentId !== null ? departmentNameById[item.departmentId] : undefined}
                            onOpen={() => onOpenAccrual(item.id)}
                        />
                    ))}
                </div>
            )}

            <p className="px-0.5 font-ui text-xs text-ink-muted">{footerNote}</p>
        </div>
    )
}

function AccrualCard({
    item,
    departmentName,
    onOpen,
}: {
    item: SalaryAccrual
    departmentName: string | undefined
    onOpen: () => void
}) {
    const progress = deriveListProgress(item.status, item.linesCount)
    const meta = [
        departmentName ?? (item.departmentId !== null ? `Отдел ${item.departmentId}` : 'Без отдела'),
        `${item.linesCount} ${pluralizeRulesCount(item.linesCount)}`,
    ].join(' · ')

    return (
        <button
            type="button"
            data-slot="accrual-card"
            onClick={onOpen}
            className="flex w-full flex-col gap-3 rounded-xl border border-hairline bg-surface p-3.5 text-left font-ui transition-colors hover:bg-canvas"
        >
            <span className="flex items-center gap-2.5">
                <Avatar className={cn(item.isDismissed && '[&_[data-slot=avatar-fallback]]:bg-danger-soft [&_[data-slot=avatar-fallback]]:text-danger')}>
                    <AvatarFallback>{employeeInitials(item.employeeName)}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-ink">{item.employeeName}</span>
                        {item.isDismissed && <DismissedBadge />}
                    </span>
                    <span className="truncate text-xs text-ink-muted">{meta}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-faint" />
            </span>

            <span className="flex items-end justify-between gap-2">
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[11px] text-ink-muted">Сумма</span>
                    <span
                        className={cn(
                            'truncate font-display text-lg font-bold tracking-[-0.3px]',
                            item.total === 0 ? 'text-ink-faint' : 'text-ink',
                        )}
                    >
                        {formatCurrency(item.total)}
                    </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                    <AccrualStatusBadge status={item.status} />
                    <span className="text-xs text-ink-muted tabular-nums">Начислено {progress.label}</span>
                </span>
            </span>

            <AccrualProgressBar progress={progress} hideLabel />
        </button>
    )
}

export { AccrualCardList }
