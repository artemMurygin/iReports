import { pluralizeEmployees, type DepartmentReportVM } from '@/features/SalaryReportData'
import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import { filterEmployeesBySearch } from '../model/filterEmployeesBySearch.ts'
import type { DepartmentDirectionBreakdown } from '../model/useDepartmentSalaryReportAll.ts'

import { AMOUNT_COLUMN_CLASS, DepartmentEmployeeGroupV2, ROW_ACTION_COL_CLASS } from './DepartmentEmployeeGroupV2.tsx'
import { DepartmentLedgerHeroV2 } from './DepartmentLedgerHeroV2.tsx'

export type DepartmentLedgerV2Props = {
    report: DepartmentReportVM
    departmentName: string | null
    /** Суммы по направлениям для героя (Split Bar + Legend) — см.
     * `DepartmentLedgerHeroV2Props.directionBreakdown`, просто прокидывается дальше. */
    directionBreakdown: DepartmentDirectionBreakdown | null
    /** Клиентский текстовый фильтр по имени сотрудника (Filter Row's Search) — влияет только на то,
     * какие строки сотрудников показаны в списке ниже. Герой-карточка наверху и футер "Итого по
     * списку" намеренно продолжают показывать `report.total`/`report.employees.length` целиком, не
     * пересчитанными по фильтру — то же готовое поле отчёта, что и раньше, без выдумывания
     * "итого по видимым" как отдельной агрегации. */
    employeeSearch: string
    className?: string
}

/**
 * Карточка-гроссбух отчёта отдела (Pencil `UO4LK`/`oJHsM` "Ledger · Зарплата отдела") — единая
 * `surface`-карточка с тенью вместо старых отдельных `DepartmentTotalsKpi` + `EmployeesTable`/
 * `EmployeesList`: герой-строка общей суммы наверху, ниже заголовок колонок один раз на всю
 * карточку, затем сотрудники одним списком (`DepartmentEmployeeGroupV2`, каждая строка — ссылка на
 * отдельный отчёт этого сотрудника), и в конце — строка-футер "Итого по списку" (Pencil `TUDZ8`).
 */
export function DepartmentLedgerV2({
    report,
    departmentName,
    directionBreakdown,
    employeeSearch,
    className,
}: DepartmentLedgerV2Props) {
    const visibleEmployees = filterEmployeesBySearch(report.employees, employeeSearch)

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
                directionBreakdown={directionBreakdown}
            />

            <div className="flex items-center justify-between gap-3 border-b border-hairline bg-canvas px-3 py-2 md:px-5 md:py-2.5">
                <span className="min-w-0 flex-1 truncate font-ui text-xs font-semibold text-ink">Сотрудник</span>
                {/* Та же no-gap группа Факт/Прогноз/спейсер, что и в строках ниже (`DepartmentEmployeeGroupV2`)
                    — см. её комментарий про `ROW_ACTION_COL_CLASS`. */}
                <span className="flex shrink-0 items-center">
                    <span className={cn(AMOUNT_COLUMN_CLASS, 'font-ui text-xs font-semibold text-ink')}>Факт, ₽</span>
                    <span className={cn(AMOUNT_COLUMN_CLASS, 'font-ui text-xs font-medium text-ink-muted')}>Прогноз, ₽</span>
                    <span className={ROW_ACTION_COL_CLASS} aria-hidden />
                </span>
            </div>

            <div>
                {visibleEmployees.length === 0 && (
                    <div className="px-3 py-6 text-center font-ui text-sm text-ink-muted md:px-5">
                        Сотрудники не найдены по запросу «{employeeSearch.trim()}».
                    </div>
                )}

                {visibleEmployees.map((employee) => (
                    <DepartmentEmployeeGroupV2 key={employee.employeeId} employee={employee} />
                ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-hairline px-3 py-3 md:px-5">
                <span className="min-w-0 flex-1 truncate font-ui text-xs font-semibold text-ink">
                    Итого · {pluralizeEmployees(report.employees.length)}
                </span>
                <span className="flex shrink-0 items-center">
                    <span className={cn(AMOUNT_COLUMN_CLASS, 'font-display text-base font-bold text-ink tabular-nums')}>
                        {formatCurrency(report.total.fact)}
                    </span>
                    <span
                        className={cn(AMOUNT_COLUMN_CLASS, 'font-display text-[15px] font-bold text-ink-muted tabular-nums')}
                    >
                        {report.total.prognose === null ? '—' : formatCurrency(report.total.prognose)}
                    </span>
                    <span className={ROW_ACTION_COL_CLASS} aria-hidden />
                </span>
            </div>
        </div>
    )
}
