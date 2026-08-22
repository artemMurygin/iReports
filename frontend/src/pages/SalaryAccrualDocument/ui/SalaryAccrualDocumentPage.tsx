import { useSalaryAccrualDocumentPage } from '../model/useSalaryAccrualDocumentPage.ts'
import { Layout } from './Layout.tsx'
import { SalaryAccrualDocumentBody } from './SalaryAccrualDocumentBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, секция «Закрытие месяца и начисления»
 * (`uKNkE`) — `jb7fL` (`Начисление · Документ`, состояние «Черновик», desktop) / `wYi5o`
 * (мобильный); состояния `JEdfH`/`fX0wq`/`L6cTJ` покрываются теми же бейджами статусов.
 * Фаза 5 docs/payroll-closing-and-accrual — чтение; действия строк, «Начислить всё» и
 * drawer корректировки (`w1BVLM`) — Фаза 9.
 */
export function SalaryAccrualDocumentPage() {
    const {
        document,
        directionLabel,
        periodLabel,
        departmentName,
        planFact,
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
                    planFact={planFact}
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
