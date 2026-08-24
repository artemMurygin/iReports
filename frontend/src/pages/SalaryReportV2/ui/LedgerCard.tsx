import { cn } from '@/shared/lib/tw'

import type { EmployeeReportVM } from '@/features/SalaryReportData'

import { LedgerDirectionBlock } from './LedgerDirectionBlock.tsx'
import { LedgerHero } from './LedgerHero.tsx'

export type LedgerCardProps = {
    report: EmployeeReportVM
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void
    className?: string
}

/**
 * Единая карточка-гроссбух (Pencil: `H7Mz74` "Ledger · Зарплата") — главное визуальное отличие
 * нового дизайна от старого `/salaries`: вместо отдельных KPI-карточек + секций направлений одна
 * карточка с общей суммой (`LedgerHero`) наверху и направлениями (`LedgerDirectionBlock`) блоками
 * ниже внутри неё же, разделёнными хairline-границей — без отдельных вкладок в шапке страницы.
 */
export function LedgerCard({ report, isRuleExpanded, onToggleRule, className }: LedgerCardProps) {
    return (
        <div
            data-slot="ledger-card"
            className={cn(
                'flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0_2px_14px_-8px_rgba(1,3,6,0.35)]',
                className,
            )}
        >
            <LedgerHero grandTotal={report.grandTotal} isClosed={report.isClosed} period={report.period} />

            {report.directions.map((directionReport) => (
                <LedgerDirectionBlock
                    key={directionReport.direction}
                    report={directionReport}
                    isRuleExpanded={isRuleExpanded}
                    onToggleRule={onToggleRule}
                    className="border-t border-hairline"
                />
            ))}
        </div>
    )
}
