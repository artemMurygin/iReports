import { ChevronRight, ScrollText } from 'lucide-react'
import type { SalaryAccrualLineSummary, SalaryRuleSummary, TargetRole, TaskDirection } from 'ireports-contracts'

import { Badge } from '@/shared/ui-kit/atoms/Badge.tsx'
import { cn } from '@/shared/lib/tw'

/**
 * Pencil: `QmF9j` (`ERP/Organism/Task Rule Card`) — `yZE5X` (правило + видимая строка начисления),
 * `r86qEK` (правило без начисления — `Rule Divider`/`Accrual Row` отключены целиком), `cW0k5` (блока
 * нет вовсе, т.к. `summary === null` — обрабатывается здесь же, не родителем, так что вызывающий код
 * может рендерить `<SalaryRuleSummaryBlock summary={rule} .../>` безусловно).
 *
 * architecture.md: `SalaryRuleSummaryBlock` — `{ summary, accrual, onOpen? }`. `direction` — отдельный
 * проп (не входит в `SalaryRuleSummary`, design.md: панель правила открывается с `ruleId`+`direction`,
 * который резолвит `useTaskSalaryReference`, не сама сводка правила).
 *
 * Иконка блока — нейтральная `canvas`/`ink-muted` (не `violet-soft`/`violet-ink`, как раньше):
 * сверено с Pencil `Q7v9pt`'s `o3xlq` (`Icon Box`) — та же нейтральная коробка, что и остальные
 * служебные иконки этой карточки задачи.
 */
const ROLE_LABEL: Record<TargetRole, string> = {
    ENGINEER: 'Инженер',
    ONLINE_MANAGER: 'Онлайн-менеджер',
    OFFLINE_MANAGER: 'Офлайн-менеджер',
    ORDER_MANAGER: 'Менеджер заказа',
    ONLINE_PURCHASER: 'Онлайн-закупщик',
    OFFLINE_PURCHASER: 'Офлайн-закупщик',
    OFFICE: 'Офис',
    SOLO_MANAGER: 'Соло-менеджер',
    DEPARTMENT_HEAD: 'Руководитель направления',
}

const DIRECTION_LABEL: Record<TaskDirection, string> = {
    service: 'Сервис',
    shop: 'Шоп',
}

const RULE_TYPE_LABEL: Record<string, string> = {
    TaskCompletion: 'За выполнение задачи',
}

const ACCRUAL_STATUS_LABEL: Record<SalaryAccrualLineSummary['status'], string> = {
    DRAFT: 'Черновик',
    ACCRUED: 'Проведено',
    PAID: 'Выплачено',
}

function formatAmount(amount: number): string {
    return `${amount.toLocaleString('ru-RU')} ₽`
}

export type SalaryRuleSummaryBlockProps = {
    summary: SalaryRuleSummary | null
    accrual: SalaryAccrualLineSummary | null
    direction: TaskDirection
    onOpen?: (args: { ruleId: string; direction: TaskDirection }) => void
    className?: string
}

export function SalaryRuleSummaryBlock({ summary, accrual, direction, onOpen, className }: SalaryRuleSummaryBlockProps) {
    if (!summary) return null

    const meta = `${RULE_TYPE_LABEL[summary.type] ?? summary.type} · ${ROLE_LABEL[summary.targetRole]} · ${DIRECTION_LABEL[direction]}`

    const body = (
        <>
            <div className="flex w-full items-center gap-2.5 p-3">
                <div className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-canvas">
                    <ScrollText className="size-4 text-ink-muted" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-ui text-[13px] font-bold text-ink">{summary.name}</p>
                    <p className="mt-[3px] truncate font-ui text-[11.5px] text-ink-muted">{meta}</p>
                </div>
                {onOpen && <ChevronRight className="size-4 shrink-0 text-ink-faint" />}
            </div>
            {accrual && (
                <>
                    <div className="h-px w-full bg-hairline" />
                    <div className="flex w-full items-center justify-between gap-2.5 bg-canvas px-3 py-2.5">
                        <div className="flex items-center gap-2">
                            <span className="font-ui text-xs text-ink-muted">Начислено за задачу</span>
                            <span className="font-display text-sm font-bold tracking-tight text-ink">
                                {formatAmount(accrual.amount)}
                            </span>
                        </div>
                        <Badge tone={accrual.status === 'DRAFT' ? 'neutral' : 'brand'}>
                            {ACCRUAL_STATUS_LABEL[accrual.status]}
                        </Badge>
                    </div>
                </>
            )}
        </>
    )

    const boxClassName = cn(
        'flex w-full flex-col overflow-hidden rounded-md border border-hairline bg-surface',
        className,
    )

    if (onOpen) {
        return (
            <button
                type="button"
                data-slot="salary-rule-summary-block"
                className={cn(boxClassName, 'text-left transition-colors hover:bg-canvas')}
                onClick={() => onOpen({ ruleId: summary.id, direction })}
            >
                {body}
            </button>
        )
    }

    return (
        <div data-slot="salary-rule-summary-block" className={boxClassName}>
            {body}
        </div>
    )
}
