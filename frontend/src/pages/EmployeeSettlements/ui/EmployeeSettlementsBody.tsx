import type { BalanceSummaryEmployee, BalanceSummaryTotals } from 'ireports-contracts'

import { EmployeeSettlementsCardList } from './EmployeeSettlementsCardList.tsx'
import { EmployeeSettlementsKpiRow } from './EmployeeSettlementsKpiRow.tsx'
import { EmployeeSettlementsTable } from './EmployeeSettlementsTable.tsx'

export type EmployeeSettlementsBodyProps = {
    employees: BalanceSummaryEmployee[]
    totals: BalanceSummaryTotals
    /** Пробрасывается в `EmployeeSettlementsCardList`'s `groupByDepartment` — группировка по
     * отделам на мобильной раскладке нужна только в режиме «Все отделы» (см. её doc). */
    departmentId: number | null
}

/**
 * Тело страницы (Фаза 4 docs/employee-settlements-page-redesign, макет `wZnzC`): десктопная
 * таблица (`EmployeeSettlementsTable`, плоская, без группировки — PRD) и мобильный карточный
 * список (`EmployeeSettlementsCardList`, с группировкой по отделу при «Все отделы»)
 * переключаются брейкпоинтом через `hidden md:block`/`md:hidden` — тот же приём, что
 * `PayoutBody` (`PayoutTable`/`PayoutCardList`), а не условный рендер по ширине окна в JS.
 */
export function EmployeeSettlementsBody({ employees, totals, departmentId }: EmployeeSettlementsBodyProps) {
    return (
        <div className="flex flex-col gap-4">
            <EmployeeSettlementsKpiRow totals={totals} employeesCount={employees.length} />
            <EmployeeSettlementsTable employees={employees} totals={totals} className="hidden md:block" />
            <EmployeeSettlementsCardList
                employees={employees}
                totals={totals}
                groupByDepartment={departmentId === null}
                className="md:hidden"
            />
        </div>
    )
}
