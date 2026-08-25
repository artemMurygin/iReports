import { formatPeriodLabel } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import type { DirectionReportVM } from '@/features/SalaryReportData'

import type { EmployeeReportBodyV2Props } from './EmployeeReportBodyV2.types.ts'
import { LedgerCard } from './LedgerCard.tsx'
import { EmptyStateCard, ErrorStateCard } from './ReportStatusCard.tsx'
import { SalesPlanCardV2 } from './SalesPlanCardV2.tsx'

/** Скелетон на время `isLoading` — тот же защитный fallback, что и у старой
 * `pages/SalaryReport/ui/EmployeeReportBody.tsx`'s `EmployeeReportSkeleton` (на практике страничный
 * `Layout`'s `RefreshTransitionLayout` уже подменяет весь `body` на `SpinnerPageLg`, пока
 * `isInitialLoad` истинен — см. `ui/SalaryReportV2Page.tsx`), только силуэт под форму карточки-
 * гроссбуха вместо пары KPI-карточек. */
function EmployeeReportSkeleton() {
    return (
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_404px]" aria-hidden>
            <div className="h-[720px] animate-pulse rounded-xl border border-hairline bg-surface" />
            <div className="hidden flex-col gap-4 xl:flex">
                <div className="h-[296px] animate-pulse rounded-xl border border-hairline bg-surface" />
                <div className="h-[296px] animate-pulse rounded-xl border border-hairline bg-surface" />
            </div>
        </div>
    )
}

/** Направление с реально загруженным планом продаж — хотя бы одна строка `salesPerformance`
 * (тот же приём, что и в старой `EmployeeReportBody`'s `hasSalesPerformance`). */
function hasSalesPerformance(direction: DirectionReportVM): boolean {
    return direction.salesPerformance.length > 0
}

/**
 * Тело отчёта сотрудника — новый дизайн (Pencil: `wLtzp` "Зарплата сотрудника REFACTORING",
 * десктоп / `b63e8p`, мобайл; узел `H7Mz74` "Ledger · Зарплата" — см.
 * `EmployeeReportBodyV2.types.ts`'s комментарий с полной картой узлов). Сам решает, что показать
 * (пусто/ошибка/загрузка/данные) — тот же контракт состояний, что и у старого
 * `pages/SalaryReport/ui/EmployeeReportBody.tsx`, но одна карточка-гроссбух (`LedgerCard`) вместо
 * KPI-строки + отдельных секций направлений.
 *
 * Раскладка: `xl:`+ — grid из двух колонок (гроссбух слева, `fill`; план продаж справа,
 * фиксированные 404px, как в мокапе `wLtzp`'s `btCZn` "Columns"); ниже `xl:` — один вертикальный
 * стек в порядке `b63e8p` (гроссбух → карточки плана), тем же приёмом, что и у старой страницы.
 */
export function EmployeeReportBodyV2({
    report,
    isLoading,
    errorMessage,
    isEmployeeSelected,
    isRuleExpanded,
    onToggleRule,
    isDirectionExpanded,
    onToggleDirection,
    className,
}: EmployeeReportBodyV2Props) {
    if (!isEmployeeSelected) {
        return (
            <EmptyStateCard className={className}>Выберите сотрудника, чтобы увидеть отчёт по зарплате.</EmptyStateCard>
        )
    }

    if (errorMessage) {
        return <ErrorStateCard className={className}>{errorMessage}</ErrorStateCard>
    }

    if (isLoading || !report) {
        return <EmployeeReportSkeleton />
    }

    if (report.directions.length === 0) {
        return (
            <EmptyStateCard className={className}>
                У сотрудника нет отчёта по зарплате ни в одном направлении за {formatPeriodLabel(report.period)}.
            </EmptyStateCard>
        )
    }

    const plansToShow = report.directions.filter(hasSalesPerformance)

    return (
        <div
            data-slot="employee-report-body-v2"
            className={cn('grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_404px]', className)}
        >
            <LedgerCard
                report={report}
                isRuleExpanded={isRuleExpanded}
                onToggleRule={onToggleRule}
                isDirectionExpanded={isDirectionExpanded}
                onToggleDirection={onToggleDirection}
                className="min-w-0"
            />

            {plansToShow.length > 0 && (
                <div className="flex min-w-0 flex-col gap-4">
                    {plansToShow.map((directionReport) => (
                        <SalesPlanCardV2
                            key={directionReport.direction}
                            label={directionReport.label}
                            period={report.period}
                            isPlanApproved={directionReport.isPlanApproved}
                            salesPerformance={directionReport.salesPerformance}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
