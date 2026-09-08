import { Building2, ChevronRight, UserRound } from 'lucide-react'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `L5GclS` (`ERP/Organism/Schema Card`) —
 * instanced on every card in both `zXpmh` (desktop 3-column grid) and `qJ0qx` (mobile single-column
 * list). `surface`-filled, 10px radius, 1px `hairline` border, 16px padding, 10px gap: `Head`
 * (title + target row on the left, direction badge on the right) -> up to 2 rule-type `Chips` + a
 * "+N" overflow chip -> a full-width `Divider` -> `Meta Row` ("N правил · Обновлено {date}" +
 * trailing chevron).
 *
 * Chip overflow is exactly 2 named chips, never 3, even though the base component defines a 3rd
 * chip slot (`X9tOAD`) — every real card instance in the mockup (`bRVce`/`KybVT`/`MLcTL`/etc.,
 * confirmed via `Get`) disables that 3rd slot and shows a "+N" chip instead as soon as there are
 * more than 2 rule types, N = total - 2. The rule-type chips carry no icon (`sVWu5`'s icon slot is
 * disabled on every chip instance here) — only the "Отдел"/"Сотрудник" filter chips elsewhere in
 * the mockup (`SchemaListFiltersMobile`) use the icon slot.
 *
 * Presentational only — every value/label arrives pre-formatted (same convention as `PlanCard`):
 * `ruleTypeLabels` is the already-resolved Russian label list (`kernel/ruleTypeLabels.ts`'s
 * `ALL_RULE_TYPE_LABELS`), `ruleCountLabel`/`updatedLabel` are pre-pluralized/pre-formatted strings
 * (`kernel/pluralizeRules.ts`, `pages/SalaryRuleList/model/formatUpdatedAt.ts`). `direction`/
 * `targetType` stay as small enums (mirrors `PlanCard`'s `status: SalesPlanStatus` prop) since they
 * only drive this component's own badge color/icon choice, not any business formatting.
 *
 * Not a `<Link>`/`<button>` itself — the whole-card-clickable behavior belongs to the consumer
 * (`pages/SalaryRuleList/ui/SchemaGrid.tsx`/`SchemaListMobile.tsx` wrap this in a `react-router`
 * `Link`), so this stays a plain, route-agnostic UI Kit component. The `hover:` styling below is
 * written directly on this root element rather than gated behind a `group`, since the wrapping
 * `Link` renders as a block with no padding of its own — hovering the link always means hovering
 * this element too.
 */
export type SchemaCardProps = {
    title: string
    direction: 'service' | 'shop'
    targetType: 'Department' | 'Employee'
    targetName: string
    /** Pre-resolved Russian rule-type labels, in display order — see file comment on why chips are
     * capped at 2 with a "+N" overflow rather than showing a 3rd real chip. */
    ruleTypeLabels: string[]
    /** Pre-pluralized "N правил"/"N правило"/"N правил". */
    ruleCountLabel: string
    /** Pre-formatted "Обновлено 12 авг 2026". */
    updatedLabel: string
    className?: string
}

const DIRECTION_BADGE: Record<SchemaCardProps['direction'], { label: string; className: string }> = {
    service: { label: 'Сервис', className: 'bg-brand-soft text-ok-ink' },
    shop: { label: 'Магазин', className: 'bg-info-soft text-info-ink' },
}

const MAX_VISIBLE_CHIPS = 2

function SchemaCard({
    title,
    direction,
    targetType,
    targetName,
    ruleTypeLabels,
    ruleCountLabel,
    updatedLabel,
    className,
}: SchemaCardProps) {
    const TargetIcon = targetType === 'Department' ? Building2 : UserRound
    const targetPrefix = targetType === 'Department' ? 'Отдел' : 'Сотрудник'
    const badge = DIRECTION_BADGE[direction]

    const visibleChips = ruleTypeLabels.slice(0, MAX_VISIBLE_CHIPS)
    const overflowCount = ruleTypeLabels.length - visibleChips.length

    return (
        <div
            data-slot="schema-card"
            className={cn(
                'flex flex-col gap-2.5 rounded-[10px] border border-hairline bg-surface p-4 font-ui transition-[border-color,box-shadow]',
                'hover:border-brand-border hover:shadow-[0_4px_14px_rgba(1,3,6,0.08)]',
                className,
            )}
        >
            <div className="flex items-start justify-between gap-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                    <span className="text-[14px] font-semibold break-words text-ink">{title}</span>
                    <div className="flex items-center gap-1.5">
                        <TargetIcon className="size-[13px] shrink-0 text-ink-muted" />
                        <span className="truncate text-xs text-ink-muted">
                            {targetPrefix}: {targetName}
                        </span>
                    </div>
                </div>
                <span className={cn('shrink-0 rounded-[6px] px-2 py-[3px] text-[11px] font-semibold', badge.className)}>
                    {badge.label}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {visibleChips.map((label) => (
                    <span
                        key={label}
                        className="rounded-[7px] border border-hairline bg-surface px-[9px] py-[3px] text-xs text-ink-muted"
                    >
                        {label}
                    </span>
                ))}
                {overflowCount > 0 && (
                    <span className="rounded-[7px] border border-hairline bg-surface px-[9px] py-[3px] text-xs font-medium text-ink">
                        +{overflowCount}
                    </span>
                )}
            </div>

            <div className="h-px w-full bg-hairline" />

            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-xs font-medium text-ink">{ruleCountLabel}</span>
                    <span className="shrink-0 text-xs text-ink-faint">·</span>
                    <span className="truncate text-xs text-ink-muted">{updatedLabel}</span>
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-faint" />
            </div>
        </div>
    )
}

export { SchemaCard }
