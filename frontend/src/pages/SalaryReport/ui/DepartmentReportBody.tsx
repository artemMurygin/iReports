import type { ReactNode } from 'react'

import { formatPeriodLabel } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import { pluralizeEmployees } from '../model/pluralizeEmployees.ts'
import { SALARY_DIRECTION_LABELS } from '../model/types.ts'

import type { DepartmentReportBodyProps } from './DepartmentReportBody.types.ts'
import { DepartmentTotalsKpi } from './DepartmentTotalsKpi.tsx'
import { EmployeesList } from './EmployeesList.tsx'
import { EmployeesTable } from './EmployeesTable.tsx'

function EmptyStateCard({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('rounded-xl border border-hairline bg-surface p-6 text-center', className)}>
            <p className="font-ui text-sm text-ink-muted">{children}</p>
        </div>
    )
}

/** Скелетон-заглушка на время `isLoading` — на практике не рендерится: страничный `Layout`
 * (`RefreshTransitionLayout`) уже подменяет весь слот `body` на `SpinnerPageLg`, пока
 * `isInitialLoad` истинен (см. `SalaryReportPage.tsx`). Ветка оставлена как защитный fallback
 * для самого компонента — контракт пропсов (`DepartmentReportBodyProps.isLoading`) допускает
 * его использование и вне этого конкретного `Layout`. */
function DepartmentReportSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-hidden>
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="h-[92px] flex-1 animate-pulse rounded-xl border border-hairline bg-surface" />
                <div className="h-[92px] flex-1 animate-pulse rounded-xl border border-hairline bg-surface" />
            </div>
            <div className="h-64 animate-pulse rounded-xl border border-hairline bg-surface" />
        </div>
    )
}

/**
 * Тело отчёта отдела (Pencil: `b6mfxv` десктоп / `d8XFk` мобайл) — KPI-ряд отдела
 * (`DepartmentTotalsKpi`) поверх таблицы сотрудников с разворотом в плоский список их правил, без
 * заказов (`EmployeesTable` на `md:`+, `EmployeesList` карточками ниже). Единственная условная
 * логика здесь — выбор состояния (не выбран/ошибка/загрузка/пусто/данные); сама разбивка на
 * колонки/карточки живёт в дочерних компонентах.
 */
export function DepartmentReportBody({
    report,
    isLoading,
    errorMessage,
    isDepartmentSelected,
    isEmployeeExpanded,
    onToggleEmployee,
    className,
}: DepartmentReportBodyProps) {
    if (!isDepartmentSelected) {
        return (
            <EmptyStateCard className={className}>Выберите отдел, чтобы увидеть отчёт по зарплате.</EmptyStateCard>
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
        return <DepartmentReportSkeleton />
    }

    if (report.employees.length === 0) {
        return (
            <EmptyStateCard className={className}>
                Нет сотрудников с начислениями за {formatPeriodLabel(report.period)}.
            </EmptyStateCard>
        )
    }

    return (
        <div data-slot="department-report-body" className={cn('flex flex-col gap-4', className)}>
            <DepartmentTotalsKpi
                total={report.total}
                employeeCount={report.employees.length}
                period={report.period}
                isClosed={report.isClosed}
            />

            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-ui text-sm font-semibold text-ink">Сотрудники отдела</span>
                    <span className="font-ui text-xs text-ink-muted">
                        {pluralizeEmployees(report.employees.length)} · направление {SALARY_DIRECTION_LABELS[report.direction]}
                    </span>
                </div>
                <p className="font-ui text-xs text-ink-muted">Нажмите на строку, чтобы раскрыть правила сотрудника.</p>
            </div>

            <EmployeesTable
                employees={report.employees}
                isClosed={report.isClosed}
                isEmployeeExpanded={isEmployeeExpanded}
                onToggleEmployee={onToggleEmployee}
                className="hidden md:block"
            />
            <EmployeesList
                employees={report.employees}
                isClosed={report.isClosed}
                isEmployeeExpanded={isEmployeeExpanded}
                onToggleEmployee={onToggleEmployee}
                className="md:hidden"
            />
        </div>
    )
}
