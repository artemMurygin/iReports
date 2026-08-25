import { useSalaryAccrualDocumentPage } from '../model/useSalaryAccrualDocumentPage.ts'
import { Layout } from './Layout.tsx'
import { SalaryAccrualDocumentBody } from './SalaryAccrualDocumentBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, секция «Закрытие месяца и начисления»
 * (`uKNkE`) — редизайн `DQ3tV` (`Начисление · Документ · Черновик REDESIGN`, desktop) /
 * `g0onp` (мобильный REDESIGN), сменивший исходные `jb7fL`/`wYi5o`; состояния
 * `JEdfH`/`fX0wq`/`L6cTJ` покрываются теми же бейджами статусов. Фаза 5
 * docs/payroll-closing-and-accrual — чтение; действия строк и «Начислить всё» — Фаза 9
 * (`AccrualLineActions`, `useAccrueDocument`); drawer корректировки — `AdjustLineModal`.
 */
export function SalaryAccrualDocumentPage() {
    const {
        document,
        directionLabel,
        periodLabel,
        departmentName,
        progress,
        isLineExpanded,
        toggleLine,
        footerNote,
        footerNoteMobile,
        footerTotal,
        goBackToList,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
    } = useSalaryAccrualDocumentPage()

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            body={
                <SalaryAccrualDocumentBody
                    document={document}
                    directionLabel={directionLabel}
                    periodLabel={periodLabel}
                    departmentName={departmentName}
                    progress={progress}
                    isLineExpanded={isLineExpanded}
                    onToggleLine={toggleLine}
                    footerNote={footerNote}
                    footerNoteMobile={footerNoteMobile}
                    footerTotal={footerTotal}
                    onBack={goBackToList}
                />
            }
        />
    )
}
