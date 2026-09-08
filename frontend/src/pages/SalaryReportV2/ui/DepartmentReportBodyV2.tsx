import { formatPeriodLabel } from '@/features/SalesPlan'

import { DepartmentLedgerV2 } from './DepartmentLedgerV2.tsx'
import type { DepartmentReportBodyV2Props } from './DepartmentReportBodyV2.types.ts'
import { EmptyStateCard, ErrorStateCard } from './ReportStatusCard.tsx'

/** Скелетон-заглушка на время `isLoading` — на практике не рендерится, т.к. страничный `Layout`
 * (`RefreshTransitionLayout`) уже подменяет весь слот `body` на `SpinnerPageLg`, пока
 * `isInitialLoad` истинен (см. `SalaryReportV2Page.tsx`). Оставлен как защитный fallback,
 * силуэтом повторяющий карточку-гроссбух (герой + строки), а не общий текст "Загрузка…". */
function DepartmentLedgerSkeleton() {
    return (
        <div
            className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0px_2px_14px_-8px_rgba(1,3,6,0.35)]"
            aria-hidden
        >
            <div className="flex animate-pulse flex-col gap-3 border-b border-hairline p-5">
                <div className="h-3 w-40 rounded bg-canvas" />
                <div className="h-8 w-52 rounded bg-canvas" />
                <div className="h-3 w-64 rounded bg-canvas" />
            </div>
            <div className="flex flex-col">
                {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="flex animate-pulse items-center gap-3 border-b border-hairline p-4 last:border-b-0">
                        <div className="size-8 shrink-0 rounded-full bg-canvas" />
                        <div className="h-3 flex-1 rounded bg-canvas" />
                        <div className="h-3 w-16 rounded bg-canvas" />
                        <div className="h-3 w-16 rounded bg-canvas" />
                    </div>
                ))}
            </div>
        </div>
    )
}

/**
 * Тело отчёта отдела нового дизайна для `/salaries` (Pencil: `wVa5g` десктоп / `z5BwMk`
 * мобайл, узел `UO4LK`/`oJHsM` "Ledger · Зарплата отдела") — единственная точка ветвления по
 * состоянию (не выбран/ошибка/загрузка/пусто/данные), сама разметка карточки живёт в
 * `DepartmentLedgerV2` и её дочерних компонентах (`frontend/CLAUDE.md`: «медиатор/страница без
 * `&&`/тернарников» — тот же приём применён и здесь на уровне презентационного компонента).
 * Полный контракт пропсов и разбор узлов — `DepartmentReportBodyV2.types.ts`.
 */
export function DepartmentReportBodyV2({
    report,
    isLoading,
    errorMessage,
    isDepartmentSelected,
    departmentName,
    directionBreakdown,
    employeeSearch,
    className,
}: DepartmentReportBodyV2Props) {
    if (!isDepartmentSelected) {
        return (
            <EmptyStateCard className={className}>Выберите отдел, чтобы увидеть отчёт по зарплате.</EmptyStateCard>
        )
    }

    if (errorMessage) {
        return <ErrorStateCard className={className}>{errorMessage}</ErrorStateCard>
    }

    if (isLoading || !report) {
        return <DepartmentLedgerSkeleton />
    }

    if (report.employees.length === 0) {
        return (
            <EmptyStateCard className={className}>
                Нет сотрудников с начислениями за {formatPeriodLabel(report.period)}.
            </EmptyStateCard>
        )
    }

    return (
        <DepartmentLedgerV2
            report={report}
            departmentName={departmentName}
            directionBreakdown={directionBreakdown}
            employeeSearch={employeeSearch}
            className={className}
        />
    )
}
