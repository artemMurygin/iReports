import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Percent } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { Divider } from '@/shared/ui-kit/atoms/Divider'
import type { EditPlanSummary as EditPlanSummaryData } from '@/features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts'
import { formatCurrency, formatPercentPrecise, pluralizeCategories } from '@/features/SalesPlan/model/format.ts'

type Props = {
    summary: EditPlanSummaryData
}

type ChipTone = 'up' | 'down'

const CHIP_TONE_CLASSNAME: Record<ChipTone, string> = {
    up: 'border-brand-border bg-brand-soft text-ok-ink',
    down: 'border-warn bg-warn-soft text-warn-ink',
}

function Chip({ tone, icon, children }: { tone: ChipTone; icon: ReactNode; children: ReactNode }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap [&_svg]:size-3',
                CHIP_TONE_CLASSNAME[tone],
            )}
        >
            {icon}
            {children}
        </span>
    )
}

function revisedNote(editedCount: number, categoriesCount: number, original: number): string {
    if (editedCount === 0) return `${categoriesCount} ${pluralizeCategories(categoriesCount)} без изменений`
    return `было ${formatCurrency(original)} · изменено ${editedCount} из ${categoriesCount}`
}

/** `EditPlanModal`'s "Plan Summary" slot (Pencil: `wumav` → `pDHMm`) — the two-metric card above
 * the editor table: draft totals for revenue/margin, each with a delta chip against the plan's
 * current saved values and a note naming how many rows changed. */
export function EditPlanSummary({ summary }: Props) {
    const { categoriesCount, editedCount, draftTurnover, draftMargin, originalTurnover, originalMargin } = summary
    const turnoverDelta = draftTurnover - originalTurnover
    const marginOfTurnover = formatPercentPrecise(draftMargin, draftTurnover)

    return (
        <div
            data-slot="edit-plan-summary"
            className="flex flex-col items-stretch gap-4 rounded-[10px] border border-hairline bg-canvas px-5 py-4 sm:flex-row sm:items-center"
        >
            <div className="flex flex-1 flex-col gap-[5px]">
                <span className="font-ui text-[11px] font-semibold tracking-[0.4px] text-ink-muted">Итого план выручки</span>
                <div className="flex items-center gap-2.5">
                    <span className="font-display text-[26px] font-bold tracking-[-0.6px] text-ink">{formatCurrency(draftTurnover)}</span>
                    {editedCount > 0 && (
                        <Chip
                            tone={turnoverDelta >= 0 ? 'up' : 'down'}
                            icon={turnoverDelta >= 0 ? <ArrowUp /> : <ArrowDown />}
                        >
                            {formatCurrency(Math.abs(turnoverDelta))}
                        </Chip>
                    )}
                </div>
                <span className="font-ui text-[11px] text-ink-muted">{revisedNote(editedCount, categoriesCount, originalTurnover)}</span>
            </div>

            <Divider orientation="horizontal" className="sm:hidden" />
            <Divider orientation="vertical" className="hidden h-14 sm:block" />

            <div className="flex flex-1 flex-col gap-[5px]">
                <span className="font-ui text-[11px] font-semibold tracking-[0.4px] text-ink-muted">Итого план маржи</span>
                <div className="flex items-center gap-2.5">
                    <span className="font-display text-[26px] font-bold tracking-[-0.6px] text-ink">{formatCurrency(draftMargin)}</span>
                    <Chip tone="up" icon={<Percent />}>
                        {marginOfTurnover} от выручки
                    </Chip>
                </div>
                <span className="font-ui text-[11px] text-ink-muted">{revisedNote(editedCount, categoriesCount, originalMargin)}</span>
            </div>
        </div>
    )
}
