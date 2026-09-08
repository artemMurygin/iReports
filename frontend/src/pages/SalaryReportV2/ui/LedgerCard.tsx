import { cn } from '@/shared/lib/tw'

import type { EmployeeReportVM, SalaryDirection } from '@/features/SalaryReportData'

import { LedgerDirectionBlock } from './LedgerDirectionBlock.tsx'
import { LedgerHero } from './LedgerHero.tsx'

export type LedgerCardProps = {
    report: EmployeeReportVM
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void
    isDirectionExpanded: (direction: SalaryDirection) => boolean
    onToggleDirection: (direction: SalaryDirection) => void
    className?: string
}

/**
 * Единая карточка-гроссбух (Pencil: `H7Mz74` "Ledger · Зарплата") — главное визуальное отличие
 * нового дизайна от старого `/salaries`: вместо отдельных KPI-карточек + секций направлений одна
 * карточка с общей суммой (`LedgerHero`) наверху и направлениями (`LedgerDirectionBlock`) блоками
 * ниже внутри неё же, разделёнными хairline-границей — без отдельных вкладок в шапке страницы.
 */
export function LedgerCard({
    report,
    isRuleExpanded,
    onToggleRule,
    isDirectionExpanded,
    onToggleDirection,
    className,
}: LedgerCardProps) {
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
                    isExpanded={isDirectionExpanded(directionReport.direction)}
                    onToggle={() => onToggleDirection(directionReport.direction)}
                    className="border-t border-hairline"
                />
            ))}
        </div>
    )
}
