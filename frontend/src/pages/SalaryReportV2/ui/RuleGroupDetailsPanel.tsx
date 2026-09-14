import { X } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { SidePanel } from '@/shared/ui-kit/organisms/SidePanel.tsx'

import { sumAllFactPrognose, SALARY_DIRECTION_LABELS, type SalaryDirection, type SalaryReportRule } from '@/features/SalaryReportData'

import { pluralizeSalaryRules } from '../model/pluralizeSalaryRules.ts'
import { formatSalesPlanNote } from '../model/salesPlanNote.ts'

import { DOT_CLASS } from './DirectionSourceCard.tsx'
import { RuleDetailSection } from './RuleDetailSection.tsx'

export type RuleGroupDetailsPanelProps = {
    /** Заголовок панели — `getRoleLabel(role)` группы роли (`DirectionSourceCard`'s строка роли) —
     * панель просто рендерит его в шапке. */
    title: string
    /** Правила группы роли (`RuleRoleGroup.rules` из `groupRulesByRole`). */
    rules: SalaryReportRule[]
    direction: SalaryDirection
    period: string
    open: boolean
    onClose: () => void
}

/** Доля факта от прогноза (`clamp(факт/прогноз * 100, 0, 100)`) для трека hero-блока — `null`, когда
 * прогноза нет вовсе (закрытый период, `factPrognoseAmountSchema`'s `prognose: null`): сравнивать
 * факт не с чем, трек/нота в этом случае не рендерятся вовсе (см. `RuleGroupDetailsPanel`), а не
 * показывают наполовину бессмысленный "100% от прогноза". Прогноз `0` (но не `null`) — единственный
 * случай реального деления на 0, трактуется как "уже перевыполнено" (100%) при ненулевом факте, как и
 * везде на этой странице (`DirectionSourceCard`'s `calcRoleSharePercent`, `SalesPlanDetailsPanel`'s
 * `calcPlanPercent`). */
function calcFactSharePercent(fact: number, prognose: number | null): number | null {
    if (prognose === null) return null
    if (prognose <= 0) return fact > 0 ? 100 : 0
    return Math.max(0, Math.min(100, Math.round((fact / prognose) * 100)))
}

/**
 * Панель детализации роли (Pencil: `design/sallary-first-iteration.pen`, узел `fGbpF`
 * "Панель · Детализация роли") — открывается кликом по строке роли (`DirectionSourceCard`). Строка
 * задачи (`TaskSourceCard`) больше не использует эту панель — открывает саму задачу
 * (`features/TaskStatusControl`'s `TaskDetailsPanel`) напрямую. Тот же `SidePanel`, что и
 * `SalesPlanDetailsPanel`/`TaskDetailsPanel`, с собственной шапкой (`srOnlyTitle` вместо `title` —
 * нужна вторая строка меты под заголовком, которую готовый слот `SidePanel` не умеет), тот же
 * приём, что и `SalesPlanDetailsPanel`.
 *
 * Hero ("Sum") — суммарный факт правил (`sumAllFactPrognose`), прогноз справа, трек и нота "N% от
 * прогноза · по зарплатным правилам" (трек/нота не рендерятся у закрытого периода — `prognose ===
 * null`, см. `calcFactSharePercent`).
 *
 * Тело группирует начисления ПО ПРАВИЛАМ (а не одним плоским списком заказов на всю роль, это была
 * явная ошибка исходного макета) — `rules.map` рендерит каждое правило через `RuleDetailSection`
 * (сама разворачивает список заказов по клику на заголовок правила). Показывает РОВНО те поля, что
 * есть в контракте отчёта (`SalaryReportRule`) — никаких "ставка/оклад за смену" из чипов мокапа:
 * контракт их не несёт (см. `RuleDetailSection`'s JSDoc), макет — только визуальная основа, не
 * источник полей.
 */
export function RuleGroupDetailsPanel({ title, rules, direction, period, open, onClose }: RuleGroupDetailsPanelProps) {
    const total = sumAllFactPrognose(rules.map((rule) => rule.amount))
    const percent = calcFactSharePercent(total.fact, total.prognose)

    return (
        <SidePanel
            open={open}
            onOpenChange={(nextOpen) => !nextOpen && onClose()}
            srOnlyTitle={title}
            className="md:w-[552px]"
            footer={
                <div className="flex items-center justify-end gap-3">
                    <span className="font-ui text-xs font-semibold text-ink-muted">Итого по роли</span>
                    <span className="font-display text-base font-bold text-ink tabular-nums">
                        {formatCurrency(total.fact)}
                    </span>
                </div>
            }
        >
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('size-2 shrink-0 rounded-full', DOT_CLASS[direction])} aria-hidden />
                        <span className="truncate font-display text-base font-bold text-ink">{title}</span>
                        <span className="shrink-0 rounded-full bg-brand-soft px-[7px] py-0.5 font-ui text-[10px] font-semibold text-ok-ink whitespace-nowrap">
                            роль
                        </span>
                    </div>
                    <span className="truncate font-ui text-[11px] text-ink-muted">
                        {SALARY_DIRECTION_LABELS[direction]} · {pluralizeSalaryRules(rules.length)} ·{' '}
                        {formatSalesPlanNote(period)}
                    </span>
                </div>
                <IconButton aria-label="Закрыть" onClick={onClose} className="shrink-0">
                    <X />
                </IconButton>
            </div>

            <div className="flex flex-col gap-2.5 border-b border-hairline px-5 py-4">
                <div className="flex items-end gap-3">
                    <span className="font-display text-[28px] font-bold tracking-[-0.3px] text-ink tabular-nums">
                        {formatCurrency(total.fact)}
                    </span>
                    <span className="min-w-0 flex-1" aria-hidden />
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="font-ui text-[10px] text-ink-muted">прогноз</span>
                        <span className="font-display text-sm font-bold text-ink-muted tabular-nums">
                            {total.prognose === null ? '—' : formatCurrency(total.prognose)}
                        </span>
                    </div>
                </div>

                {percent !== null && (
                    <>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-hairline">
                            <div className="h-full rounded-full bg-brand-strong" style={{ width: `${percent}%` }} />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-ui text-[11px] font-medium text-ink">{percent}% от прогноза</span>
                            <span className="font-ui text-[11px] text-ink-faint">·</span>
                            <span className="font-ui text-[11px] text-ink-muted">по зарплатным правилам</span>
                        </div>
                    </>
                )}
            </div>

            {rules.length === 0 ? (
                <p className="px-5 py-4 text-center font-ui text-xs text-ink-muted">Нет начислений.</p>
            ) : (
                <div className="flex flex-col">
                    {rules.map((rule) => (
                        <RuleDetailSection key={rule.ruleId} rule={rule} />
                    ))}
                </div>
            )}
        </SidePanel>
    )
}
