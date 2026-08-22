import { Store, Wrench } from 'lucide-react'

import { AccrualStatusBadge } from '@/features/SalaryAccruals'
import { formatCurrency } from '@/features/SalesPlan'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { cn } from '@/shared/lib/tw'

import type { DirectionReportVM, SalaryDirection } from '../model/types.ts'

import { RulesList } from './RulesList.tsx'
import { RulesTable } from './RulesTable.tsx'

export type DirectionSectionProps = {
    report: DirectionReportVM
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void
    className?: string
}

const DIRECTION_ICONS: Record<SalaryDirection, typeof Wrench> = {
    service: Wrench,
    shop: Store,
}

/**
 * Pencil: `t3QCM`'s "Section · Сервис/Магазин" (`eYHlG`) / `Z0lgF`'s "Секция · Сервис" (`sy1VF`)
 * — заголовок направления (иконка + название + «N правил», факт/прогноз по направлению справа)
 * поверх `RulesTable`/`RulesList`. Закрытое направление (`report.isClosed`) не показывает прогноз
 * по направлению как число — вместо суммы «Месяц закрыт» (`warn-ink`), т.к. `total.prognose`
 * гарантированно `null` для закрытого направления (см. `factPrognoseAmountSchema`'s комментарий в
 * контракте) и подменять его нулём/тем же фактом было бы неверно.
 */
export function DirectionSection({ report, isRuleExpanded, onToggleRule, className }: DirectionSectionProps) {
    const Icon = DIRECTION_ICONS[report.direction]

    return (
        <section data-slot="direction-section" className={cn('flex flex-col gap-3', className)}>
            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
                <div className="flex items-center gap-2">
                    <Icon className="size-[17px] shrink-0 text-ink" />
                    <div className="flex flex-col">
                        <span className="font-ui text-base font-bold text-ink">{report.label}</span>
                        <span className="font-ui text-xs text-ink-muted">{pluralizeRules(report.rules.length)}</span>
                    </div>
                    {/* Статус документа начисления за закрытый период (Фаза 5
                        docs/payroll-closing-and-accrual, PRD 1 «Отчёт сотрудника»): бейдж
                        «Черновик → … → Выплачено»; null — период открыт или документа нет. */}
                    {report.accrualStatus !== null && <AccrualStatusBadge status={report.accrualStatus} />}
                </div>

                <div className="flex items-center gap-5">
                    <div className="flex flex-col gap-0.5">
                        <span className="font-ui text-[11px] font-medium text-ink-muted">Факт по направлению</span>
                        <span className="font-ui text-base font-bold text-ink tabular-nums">
                            {formatCurrency(report.total.fact)}
                        </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="font-ui text-[11px] font-medium text-ink-muted">Прогноз по направлению</span>
                        <span
                            className={cn(
                                'font-ui text-base font-bold tabular-nums',
                                report.total.prognose === null ? 'text-warn-ink' : 'text-ink-muted',
                            )}
                        >
                            {report.total.prognose === null
                                ? report.isClosed
                                    ? 'Месяц закрыт'
                                    : '—'
                                : formatCurrency(report.total.prognose)}
                        </span>
                    </div>
                </div>
            </div>

            <RulesTable
                rules={report.rules}
                direction={report.direction}
                isClosed={report.isClosed}
                isRuleExpanded={isRuleExpanded}
                onToggleRule={onToggleRule}
                className="hidden md:block"
            />
            <RulesList
                rules={report.rules}
                direction={report.direction}
                isClosed={report.isClosed}
                isRuleExpanded={isRuleExpanded}
                onToggleRule={onToggleRule}
                className="md:hidden"
            />
        </section>
    )
}
