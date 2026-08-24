import { Banknote, CreditCard, SlidersHorizontal, Wallet } from 'lucide-react'
import type { DepartmentBalancesTotals, DepartmentEmployeeBalance } from 'ireports-contracts'

import { formatCurrency, formatSignedCurrency } from '@/features/SalesPlan'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'

export type DepartmentBalancesKpiRowProps = {
    totals: DepartmentBalancesTotals
    employees: DepartmentEmployeeBalance[]
    periodLabel: string
    className?: string
}

/**
 * Pencil `IFJW2` (KPI Row): «Остаток по отделу» / «Начислено за месяц» / «Выдано авансов» /
 * «Ручные движения» — значения из `totals` ответа `getDepartmentBalances` (Фаза 8b: суммы
 * общие по сотруднику, без разбивки по направлениям, как и колонка «Остаток» таблицы ниже).
 * На мобильном (`iEYMb`) те же карточки сеткой 2×2 — тот же приём, что `AccrualsKpiRow`.
 *
 * Подписи карточек — производные от построчных `employees`, т.к. ответ не несёт отдельных
 * счётчиков документов/движений: «N сотрудников» (остаток), «N начислений · M ожидают
 * выплаты» (`accrualStatus === 'ACCRUED'`, та же семантика, что `AccrualStatusBadge`),
 * приход/расход ручных движений — сумма положительных/отрицательных построчных `manual`.
 */
function DepartmentBalancesKpiRow({ totals, employees, periodLabel, className }: DepartmentBalancesKpiRowProps) {
    const documentsCount = employees.filter((employee) => employee.accrualStatus !== null).length
    const awaitingCount = employees.filter((employee) => employee.accrualStatus === 'ACCRUED').length
    const manualIncome = employees
        .filter((employee) => employee.manual > 0)
        .reduce((sum, employee) => sum + employee.manual, 0)
    const manualOutcome = employees
        .filter((employee) => employee.manual < 0)
        .reduce((sum, employee) => sum + employee.manual, 0)

    return (
        <div data-slot="department-balances-kpi-row" className={className}>
            <div className="grid grid-cols-2 gap-2.5 md:flex md:flex-row md:gap-4">
                <KpiCard
                    label="Остаток по отделу"
                    value={formatCurrency(totals.balance)}
                    note={`${employees.length} сотрудников · ${periodLabel}`}
                    icon={<Wallet />}
                />
                <KpiCard
                    label="Начислено за месяц"
                    value={formatCurrency(totals.accrued)}
                    note={
                        documentsCount > 0
                            ? `${documentsCount} начислений · ${awaitingCount} ожидают выплаты`
                            : 'документов нет'
                    }
                    icon={<Banknote />}
                />
                <KpiCard
                    label="Выдано авансов"
                    value={formatCurrency(totals.advances)}
                    note={periodLabel}
                    icon={<CreditCard />}
                />
                <KpiCard
                    label="Ручные движения"
                    value={formatSignedCurrency(totals.manual)}
                    note={`приход ${formatSignedCurrency(manualIncome)} · расход ${formatSignedCurrency(manualOutcome)}`}
                    icon={<SlidersHorizontal />}
                />
            </div>
        </div>
    )
}

export { DepartmentBalancesKpiRow }
