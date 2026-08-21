import type { ReactNode } from 'react'
import type { SalesPerformanceSummary } from 'ireports-contracts'

import { formatPeriodLabel } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import type { DirectionReportVM } from '../model/types.ts'

import { DirectionSection } from './DirectionSection.tsx'
import type { EmployeeReportBodyProps } from './EmployeeReportBody.types.ts'
import { SalaryTotalsKpi } from './SalaryTotalsKpi.tsx'
import { SalesPlanCard } from './SalesPlanCard.tsx'

function EmptyStateCard({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('rounded-xl border border-hairline bg-surface p-6 text-center', className)}>
            <p className="font-ui text-sm text-ink-muted">{children}</p>
        </div>
    )
}

/** Скелетон-заглушка на время `isLoading` — на практике не рендерится: страничный `Layout`
 * (`RefreshTransitionLayout`) уже подменяет весь слот `body` на `SpinnerPageLg`, пока
 * `isInitialLoad` истинен (см. `SalaryReportPage.tsx`). Ветка оставлена как защитный fallback для
 * самого компонента (тот же приём, что и `DepartmentReportBody`'s `DepartmentReportSkeleton`) —
 * контракт пропсов (`EmployeeReportBodyProps.isLoading`) допускает его использование и вне этого
 * конкретного `Layout`. */
function EmployeeReportSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-hidden>
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="h-[92px] flex-1 animate-pulse rounded-xl border border-hairline bg-surface" />
                <div className="h-[92px] flex-1 animate-pulse rounded-xl border border-hairline bg-surface" />
            </div>
            <div className="h-64 animate-pulse rounded-xl border border-hairline bg-surface" />
            <div className="h-64 animate-pulse rounded-xl border border-hairline bg-surface" />
        </div>
    )
}

/** Направление с реально загруженным планом продаж — сужает `salesPerformance` из `nullable` до
 * обязательного поля, чтобы `SalesPlanCard` (которая его рендерит) не занималась этой проверкой
 * сама (см. её комментарий про то, что контракт отдаёт одну сводку, а не список категорий). */
function hasSalesPerformance(
    direction: DirectionReportVM,
): direction is DirectionReportVM & { salesPerformance: SalesPerformanceSummary } {
    return direction.salesPerformance !== null
}

/**
 * Тело отчёта сотрудника (Pencil: `t3QCM` "Зарплата сотрудника · Вариант 2 (Две колонки)",
 * десктоп / `Z0lgF`, мобайл) — сам решает, что показать (пусто/ошибка/загрузка/данные), пропы
 * (`EmployeeReportBody.types.ts`) финальны и не менялись.
 *
 * Раскладка: `xl:`+ — grid из двух колонок (левая — KPI + секции направлений, `fill`; правая —
 * карточки плана продаж, фиксированные 404px, как в мокапе `t3QCM`'s "Columns"); ниже `xl:` — один
 * стек в порядке Z0lgF (KPI → секции направлений → карточки плана), поскольку фиксированная
 * 404px-колонка рядом с содержательной левой частью не помещается на планшетных ширинах — сам
 * `RulesTable`/`RulesList` внутри `DirectionSection` переключается на своём привычном `md:`.
 *
 * Направления без отчёта (404 — сотрудник не работает в этом направлении) уже отфильтрованы на
 * уровне `useEmployeeSalaryReport` (`report.directions` содержит только реально найденные), поэтому
 * здесь просто `.map` без дополнительных проверок; направления без `salesPerformance` (План ещё не
 * посчитан — Фаза 5) не получают карточку плана (`hasSalesPerformance`).
 */
export function EmployeeReportBody({
    report,
    isLoading,
    errorMessage,
    isEmployeeSelected,
    isRuleExpanded,
    onToggleRule,
    className,
}: EmployeeReportBodyProps) {
    if (!isEmployeeSelected) {
        return (
            <EmptyStateCard className={className}>Выберите сотрудника, чтобы увидеть отчёт по зарплате.</EmptyStateCard>
        )
    }

    if (errorMessage) {
        return (
            <div className={cn('rounded-xl border border-hairline bg-surface p-6 text-center', className)}>
                <p className="font-ui text-sm text-danger">{errorMessage}</p>
            </div>
        )
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
            data-slot="employee-report-body"
            className={cn('grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_404px]', className)}
        >
            <div className="flex min-w-0 flex-col gap-5">
                <SalaryTotalsKpi grandTotal={report.grandTotal} isClosed={report.isClosed} period={report.period} />

                {report.directions.map((directionReport) => (
                    <DirectionSection
                        key={directionReport.direction}
                        report={directionReport}
                        isRuleExpanded={isRuleExpanded}
                        onToggleRule={onToggleRule}
                    />
                ))}
            </div>

            {plansToShow.length > 0 && (
                <div className="flex min-w-0 flex-col gap-4">
                    {plansToShow.map((directionReport) => (
                        <SalesPlanCard
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
