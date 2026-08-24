import type { DepartmentReportVM } from '@/features/SalaryReportData'
import { cn } from '@/shared/lib/tw'

import { AMOUNT_COLUMN_CLASS, DepartmentEmployeeGroupV2, ROW_ACTION_COL_CLASS } from './DepartmentEmployeeGroupV2.tsx'
import { DepartmentLedgerHeroV2 } from './DepartmentLedgerHeroV2.tsx'

export type DepartmentLedgerV2Props = {
    report: DepartmentReportVM
    departmentName: string | null
    isEmployeeExpanded: (employeeId: number) => boolean
    onToggleEmployee: (employeeId: number) => void
    className?: string
}

/**
 * Карточка-гроссбух отчёта отдела (Pencil `UO4LK`/`oJHsM` "Ledger · Зарплата отдела") — единая
 * `surface`-карточка с тенью вместо старых отдельных `DepartmentTotalsKpi` + `EmployeesTable`/
 * `EmployeesList`: герой-строка общей суммы наверху, ниже заголовок колонок один раз на всю
 * карточку, затем сотрудники одним списком (`DepartmentEmployeeGroupV2`), у каждого — его правила
 * сразу под строкой, если она развёрнута.
 */
export function DepartmentLedgerV2({
    report,
    departmentName,
    isEmployeeExpanded,
    onToggleEmployee,
    className,
}: DepartmentLedgerV2Props) {
    return (
        <div
            data-slot="department-ledger-v2"
            className={cn(
                'overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0px_2px_14px_-8px_rgba(1,3,6,0.35)]',
                className,
            )}
        >
            <DepartmentLedgerHeroV2
                total={report.total}
                employeeCount={report.employees.length}
                departmentName={departmentName}
                period={report.period}
                isClosed={report.isClosed}
            />

            <div className="flex items-center justify-between gap-3 border-b border-hairline bg-canvas px-3 py-2 md:px-5 md:py-2.5">
                <span className="min-w-0 flex-1 truncate font-ui text-xs font-semibold text-ink">
                    Сотрудник · правило начисления
                </span>
                {/* Та же no-gap группа Факт/Прогноз/спейсер, что и в строках ниже (`DepartmentEmployeeGroupV2`)
                    — см. её комментарий про `ROW_ACTION_COL_CLASS`. */}
                <span className="flex shrink-0 items-center">
                    <span className={cn(AMOUNT_COLUMN_CLASS, 'font-ui text-xs font-semibold text-ink')}>Факт, ₽</span>
                    <span className={cn(AMOUNT_COLUMN_CLASS, 'font-ui text-xs font-medium text-ink-muted')}>Прогноз, ₽</span>
                    <span className={ROW_ACTION_COL_CLASS} aria-hidden />
                </span>
            </div>

            <div>
                {report.employees.map((employee) => (
                    <DepartmentEmployeeGroupV2
                        key={employee.employeeId}
                        employee={employee}
                        isClosed={report.isClosed}
                        expanded={isEmployeeExpanded(employee.employeeId)}
                        onToggle={() => onToggleEmployee(employee.employeeId)}
                    />
                ))}
            </div>
        </div>
    )
}
