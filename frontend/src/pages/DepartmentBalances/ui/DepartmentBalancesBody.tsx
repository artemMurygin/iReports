import type { DepartmentBalancesTotals, DepartmentEmployeeBalance } from 'ireports-contracts'

import { DepartmentBalancesCardList } from './DepartmentBalancesCardList.tsx'
import { DepartmentBalancesKpiRow } from './DepartmentBalancesKpiRow.tsx'
import { DepartmentBalancesTable } from './DepartmentBalancesTable.tsx'

export type DepartmentBalancesBodyProps = {
    departmentId: number | null
    employees: DepartmentEmployeeBalance[]
    totals: DepartmentBalancesTotals
    periodLabel: string
}

/**
 * Единственная точка ветвления страницы (конвенция «медиатор без условного рендера»,
 * frontend/CLAUDE.md): отдел не выбран -> подсказка «Выберите отдел»; выбран -> KPI Row +
 * таблица (`md:` и выше) / карточки (ниже `md:`), тот же приём, что `SalaryAccrualsBody`
 * ветвит по `isClosed` и переключает `AccrualsTable`/`AccrualCardList` по брейкпоинту.
 */
export function DepartmentBalancesBody({ departmentId, employees, totals, periodLabel }: DepartmentBalancesBodyProps) {
    if (departmentId === null) {
        return (
            <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-hairline bg-surface px-4 py-16 text-center">
                <p className="font-ui text-sm font-semibold text-ink">Выберите отдел</p>
                <p className="font-ui text-xs text-ink-muted">Сводка балансов появится после выбора отдела вверху страницы</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4">
            <DepartmentBalancesKpiRow totals={totals} employees={employees} periodLabel={periodLabel} />

            <DepartmentBalancesTable employees={employees} totals={totals} className="hidden md:block" />
            <DepartmentBalancesCardList employees={employees} className="md:hidden" />
        </div>
    )
}
