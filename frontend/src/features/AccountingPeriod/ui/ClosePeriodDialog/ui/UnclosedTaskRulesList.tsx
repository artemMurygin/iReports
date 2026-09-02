import { CircleAlert, TriangleAlert } from 'lucide-react'
import type { UnclosedTaskRule } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { TASK_RULE_STATUS_LABEL } from '../../../model/labels.ts'

export type UnclosedTaskRulesListProps = {
    rules: UnclosedTaskRule[]
    /** ФИО сотрудника по Bitrix id (справочник страницы, тот же `employeeNameById`, что уже
     * резолвит `closedLabel`/`ReopenPeriodDialog` в `useSalesPlanPage.ts`) — сводка close-preview
     * несёт только `employeeId`. */
    employeeNameById: Record<number, string>
}

/**
 * Перечень правил-задач месяца, чьи задачи ещё не «Закрыта» (spec.md change salary-rule-bitrix-task,
 * "Список незакрытых задач перед закрытием периода" — задача 10.4). В отличие от
 * `UnapprovedRowsList` НЕ блокирует закрытие месяца (спека не требует этого — только "руководитель
 * SHALL увидеть список"), поэтому рендерится информационным блоком без влияния на `canSubmit` и без
 * действия у строки. Задача в статусе "Закрыта" в список не попадает вовсе (её отдаёт бэкенд,
 * `ListUnclosedTaskRulesForPeriodService`) — только "Ждёт выполнения"/"Выполняется"/недоступные.
 */
function UnclosedTaskRulesList({ rules, employeeNameById }: UnclosedTaskRulesListProps) {
    if (rules.length === 0) return null

    return (
        <div className="flex flex-col gap-2.5">
            <h3 className="font-ui text-sm font-bold text-ink">Незакрытые задачи-правила</h3>
            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                {rules.map((rule) => {
                    const employeeName = employeeNameById[rule.employeeId] ?? `Сотрудник ${rule.employeeId}`
                    const statusLabel = rule.isUnavailable
                        ? 'Задача недоступна'
                        : (rule.status && TASK_RULE_STATUS_LABEL[rule.status]) || null

                    return (
                        <li key={rule.ruleId} className="flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    {rule.isUnavailable ? (
                                        <TriangleAlert className="size-3.5 shrink-0 text-danger" />
                                    ) : (
                                        <CircleAlert className="size-3.5 shrink-0 text-warn" />
                                    )}
                                    <span className="min-w-0 truncate font-ui text-[13px] font-semibold text-ink">
                                        {rule.ruleName}
                                    </span>
                                    <span className="hidden shrink-0 font-ui text-[12px] text-ink-muted sm:inline">
                                        · {employeeName}
                                    </span>
                                </div>
                                <span className="mt-0.5 block truncate font-ui text-[11px] text-ink-muted sm:hidden">
                                    {employeeName}
                                </span>
                            </div>
                            {statusLabel && (
                                <span
                                    className={cn(
                                        'shrink-0 rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                                        rule.isUnavailable ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn-ink',
                                    )}
                                >
                                    {statusLabel}
                                </span>
                            )}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

export { UnclosedTaskRulesList }
