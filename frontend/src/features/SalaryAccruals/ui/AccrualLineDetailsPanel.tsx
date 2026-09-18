import { UserRound, X } from 'lucide-react'
import type { SalaryAccrualLine, SalesDirection } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Chip } from '@/shared/ui-kit/atoms/Chip'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { SidePanel } from '@/shared/ui-kit/organisms/SidePanel.tsx'

import { formatLineMeta, isLineAdjusted } from '../model/accrualView.ts'
import { ROLE_LABEL } from '../model/labels.ts'

import { AccrualLineSources } from './AccrualLineSources.tsx'
import { AdjustmentBadge } from './AccrualStatusBadge.tsx'

const DOT_CLASS: Record<SalesDirection, string> = {
    service: 'bg-brand-strong',
    shop: 'bg-info-ink',
}

export type AccrualLineDetailsPanelProps = {
    /** Строка документа целиком (не `ruleId`) — все нужные данные (в т.ч. `sources`) уже загружены
     * вместе с документом, отдельного похода в API для панели не требуется. */
    line: SalaryAccrualLine | null
    direction: SalesDirection
    open: boolean
    onClose: () => void
}

/**
 * Панель детализации строки начисления (Pencil: тот же `SidePanel`-паттерн, что и
 * `pages/SalaryReportV2/ui/RuleGroupDetailsPanel` на странице зарплаты — hero-шапка с точкой
 * направления/названием/суммой и список источников ниже) — открывается кликом по строке в
 * `AccrualLinesTable`/`AccrualLineCardList` вместо прежнего аккордеона на месте и вместо
 * `features/SalaryRuleDetailsPanel` (статическое описание правила туда больше не ведёт — здесь
 * нужна не формула правила, а "за какие заказы что начислено", то есть `AccrualLineSources`).
 */
export function AccrualLineDetailsPanel({ line, direction, open, onClose }: AccrualLineDetailsPanelProps) {
    return (
        <SidePanel
            open={open}
            onOpenChange={(nextOpen) => !nextOpen && onClose()}
            srOnlyTitle={line?.name ?? 'Детализация начисления'}
        >
            {line && <AccrualLineDetailsPanelContent line={line} direction={direction} onClose={onClose} />}
        </SidePanel>
    )
}

type AccrualLineDetailsPanelContentProps = {
    line: SalaryAccrualLine
    direction: SalesDirection
    onClose: () => void
}

function AccrualLineDetailsPanelContent({ line, direction, onClose }: AccrualLineDetailsPanelContentProps) {
    const adjusted = isLineAdjusted(line)

    return (
        <>
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('size-2 shrink-0 rounded-full', DOT_CLASS[direction])} aria-hidden />
                        <span className="truncate font-display text-base font-bold text-ink">{line.name}</span>
                        {adjusted && <AdjustmentBadge />}
                    </div>
                    <span className="flex flex-wrap items-center gap-2 font-ui text-[11px] text-ink-muted">
                        <Chip icon={<UserRound />}>{ROLE_LABEL[line.targetRole]}</Chip>
                        {formatLineMeta(line)}
                    </span>
                </div>
                <IconButton aria-label="Закрыть" onClick={onClose} className="shrink-0">
                    <X />
                </IconButton>
            </div>

            <div className="flex flex-col gap-0.5 border-b border-hairline px-5 py-4">
                {adjusted && (
                    <span className="font-ui text-xs text-ink-faint line-through tabular-nums">
                        Было: {formatCurrency(line.originalAmount)}
                    </span>
                )}
                <span className="font-display text-[28px] font-bold tracking-[-0.3px] text-ink tabular-nums">
                    {formatCurrency(line.amount)}
                </span>
            </div>

            <AccrualLineSources sources={line.sources} />
        </>
    )
}
