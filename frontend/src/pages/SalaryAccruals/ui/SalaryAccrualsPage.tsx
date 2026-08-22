import { useSalaryAccrualsPage } from '../model/useSalaryAccrualsPage.ts'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'
import { SalaryAccrualsBody } from './SalaryAccrualsBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, секция «Закрытие месяца и начисления»
 * (`uKNkE`) — `cfNlL` (`Начисления · Список`, desktop), `g6vEv` (empty-state «месяц ещё
 * не закрыт»), `Q0i6z3` (мобильный). Фаза 5 docs/payroll-closing-and-accrual — чтение;
 * Selection Bar / «Начислить все документы месяца» (`yDI1H`) — Фаза 9.
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `useSalaryAccrualsPage`,
 * ветвления — в `SalaryAccrualsBody`.
 */
export function SalaryAccrualsPage() {
    const {
        direction,
        setDirection,
        period,
        setPeriod,
        periodLabel,
        isClosed,
        closedLabel,
        items,
        summary,
        statusCounts,
        statusFilter,
        setStatusFilter,
        search,
        setSearch,
        departmentNameById,
        footerNote,
        footerTotal,
        openAccrual,
        goToSalesPlan,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
        periodDirectionLabel,
    } = useSalaryAccrualsPage()

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            header={
                <PageHeader
                    direction={direction}
                    onDirectionChange={setDirection}
                    period={period}
                    onPeriodChange={setPeriod}
                    isPeriodClosed={isClosed}
                    closedLabel={closedLabel}
                />
            }
            body={
                <SalaryAccrualsBody
                    isClosed={isClosed}
                    periodLabel={periodLabel}
                    periodDirectionLabel={periodDirectionLabel}
                    items={items}
                    summary={summary}
                    statusCounts={statusCounts}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    search={search}
                    onSearchChange={setSearch}
                    departmentNameById={departmentNameById}
                    footerNote={footerNote}
                    footerTotal={footerTotal}
                    onOpenAccrual={openAccrual}
                    onGoToSalesPlan={goToSalesPlan}
                />
            }
        />
    )
}
