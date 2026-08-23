import { ArrowUpRight } from 'lucide-react'
import type { SalaryAccrual } from 'ireports-contracts'

import { formatNumber } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'

import { deriveListProgress, employeeInitials } from '../model/accrualView.ts'

import { AccrualProgressBar } from './AccrualProgressBar.tsx'
import { AccrualStatusBadge, DismissedBadge } from './AccrualStatusBadge.tsx'

const COLUMN_WIDTH = {
    rules: 'w-[90px]',
    amount: 'w-[150px]',
    status: 'w-[180px]',
    progress: 'w-[230px]',
    actions: 'w-[64px]',
}

/**
 * Pencil `cfNlL` (`Начисления · Список`, десктопная таблица): Сотрудник (аватар-инициалы +
 * ФИО + отдел, бейдж «Уволен») · Правил · Сумма, ₽ · Статус · Прогресс начисления ·
 * Действия (иконка «открыть»). Колонка чекбоксов (Фаза 9, `useAccrualSelection` со страницы
 * — тот же приём, что `SalesPlanTable`) — выбор строк для «Начислить выбранным»; `PAID`
 * нельзя выбрать (документ уже полностью начислен), чекбокс такой строки `disabled`.
 *
 * Прогресс строки выводится из статуса документа (`deriveListProgress`) — ответ списка
 * не несёт числа начисленных строк, см. комментарий производной.
 */
export type AccrualsTableProps = {
    items: SalaryAccrual[]
    /** Название отдела по id (справочник Bitrix, features/TargetDirectory — композиция на странице). */
    departmentNameById: Record<number, string>
    onOpenAccrual: (id: string) => void
    /** «Показано N из M документов · июль 2026 · направление «Сервис»» — подвал таблицы. */
    footerNote: string
    /** «Итого 3 214 800 ₽». */
    footerTotal: string
    /** `AccrualSelection` из `useAccrualSelection` (features/SalaryAccruals/model) — та же
     * инстанция, что читает Selection Bar на странице. */
    selectedIds: Set<string>
    onToggleRow: (id: string) => void
    onToggleAll: () => void
    isAllSelected: boolean
    isIndeterminate: boolean
    className?: string
}

function AccrualsTable({
    items,
    departmentNameById,
    onOpenAccrual,
    footerNote,
    footerTotal,
    selectedIds,
    onToggleRow,
    onToggleAll,
    isAllSelected,
    isIndeterminate,
    className,
}: AccrualsTableProps) {
    return (
        <div
            data-slot="accruals-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div className="min-w-[940px]">
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        <div className="flex h-10 w-11 shrink-0 items-center justify-center">
                            <Checkbox
                                checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                                onCheckedChange={onToggleAll}
                                aria-label="Выбрать все документы"
                            />
                        </div>
                        <ColumnHeader label="Сотрудник" className="min-w-[220px] flex-1" />
                        <ColumnHeader label="Правил" align="end" className={COLUMN_WIDTH.rules} />
                        <ColumnHeader label="Сумма, ₽" align="end" emphasis className={COLUMN_WIDTH.amount} />
                        <ColumnHeader label="Статус" className={COLUMN_WIDTH.status} />
                        <ColumnHeader label="Прогресс начисления" className={COLUMN_WIDTH.progress} />
                        <ColumnHeader label="" className={COLUMN_WIDTH.actions} />
                    </div>

                    {items.length === 0 ? (
                        <p className="px-4 py-8 text-center font-ui text-xs text-ink-muted">
                            Под выбранный фильтр не попал ни один документ.
                        </p>
                    ) : (
                        items.map((item) => (
                            <AccrualsTableRow
                                key={item.id}
                                item={item}
                                departmentName={
                                    item.departmentId !== null ? departmentNameById[item.departmentId] : undefined
                                }
                                onOpen={() => onOpenAccrual(item.id)}
                                selected={selectedIds.has(item.id)}
                                onToggle={() => onToggleRow(item.id)}
                            />
                        ))
                    )}

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

function AccrualsTableRow({
    item,
    departmentName,
    onOpen,
    selected,
    onToggle,
}: {
    item: SalaryAccrual
    departmentName: string | undefined
    onOpen: () => void
    selected: boolean
    onToggle: () => void
}) {
    const progress = deriveListProgress(item.status, item.linesCount)
    const isPaid = item.status === 'PAID'

    return (
        <div
            data-slot="accruals-table-row"
            onClick={onOpen}
            className="flex cursor-pointer items-center border-b border-hairline transition-colors last:border-b-0 hover:bg-canvas"
        >
            <div
                className="flex w-11 shrink-0 items-center justify-center self-stretch"
                onClick={(event) => event.stopPropagation()}
            >
                <Checkbox
                    checked={selected}
                    onCheckedChange={onToggle}
                    disabled={isPaid}
                    aria-label={`Выбрать документ: ${item.employeeName}`}
                />
            </div>

            <div className="flex min-w-[220px] flex-1 items-center gap-3 px-3 py-2.5">
                <Avatar
                    className={cn(
                        item.isDismissed &&
                            '[&_[data-slot=avatar-fallback]]:bg-danger-soft [&_[data-slot=avatar-fallback]]:text-danger',
                    )}
                >
                    <AvatarFallback>{employeeInitials(item.employeeName)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2">
                        <span className="truncate font-ui text-sm font-semibold text-ink">{item.employeeName}</span>
                        {item.isDismissed && <DismissedBadge />}
                    </span>
                    <span className="truncate font-ui text-xs text-ink-muted">
                        {departmentName ?? (item.departmentId !== null ? `Отдел ${item.departmentId}` : 'Без отдела')}
                    </span>
                </div>
            </div>

            <span
                className={cn(
                    'shrink-0 px-3 text-right font-ui text-sm text-ink-muted tabular-nums',
                    COLUMN_WIDTH.rules,
                )}
            >
                {item.linesCount}
            </span>
            <span
                className={cn(
                    'shrink-0 px-3 text-right font-ui text-sm font-bold tabular-nums',
                    item.total === 0 ? 'text-ink-faint' : 'text-ink',
                    COLUMN_WIDTH.amount,
                )}
            >
                {formatNumber(item.total)}
            </span>

            <div className={cn('shrink-0 px-3', COLUMN_WIDTH.status)}>
                <AccrualStatusBadge status={item.status} />
            </div>

            <div className={cn('shrink-0 px-3', COLUMN_WIDTH.progress)}>
                <AccrualProgressBar progress={progress} />
            </div>

            <div className={cn('flex shrink-0 items-center justify-center px-3', COLUMN_WIDTH.actions)}>
                <IconButton type="button" aria-label={`Открыть документ начисления: ${item.employeeName}`}>
                    <ArrowUpRight />
                </IconButton>
            </div>
        </div>
    )
}

export { AccrualsTable }
