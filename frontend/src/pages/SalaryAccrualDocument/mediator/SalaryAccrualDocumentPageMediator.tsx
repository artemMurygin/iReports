import { AccrualLineDetailsPanel } from '@/features/SalaryAccruals'
import { TaskDetailsPanel } from '@/features/TaskStatusControl'

import { useSalaryAccrualDocumentPage } from '../model/useSalaryAccrualDocumentPage.ts'
import { Layout } from '../ui/Layout.tsx'
import { SalaryAccrualDocumentBody } from '../ui/SalaryAccrualDocumentBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, секция «Закрытие месяца и начисления»
 * (`uKNkE`) — редизайн `DQ3tV` (`Начисление · Документ · Черновик REDESIGN`, desktop) /
 * `g0onp` (мобильный REDESIGN), сменивший исходные `jb7fL`/`wYi5o`; состояния
 * `JEdfH`/`fX0wq`/`L6cTJ` покрываются теми же бейджами статусов. Фаза 5
 * docs/payroll-closing-and-accrual — чтение; действия строк и «Начислить всё» — Фаза 9
 * (`AccrualLineActions`, `useAccrueDocument`); drawer корректировки — `AdjustLineModal`.
 *
 * Клик по строке начисления открывает боковую панель детализации источников
 * (`features/SalaryAccruals`'s `AccrualLineDetailsPanel`) — тот же паттерн, что и на странице
 * зарплаты (`pages/SalaryReportV2`'s `RuleGroupDetailsPanel`): один клик, одна боковая панель с
 * "за какие заказы что начислено", без отдельной панели статического описания правила
 * (`features/SalaryRuleDetailsPanel`, здесь больше не используется) и без аккордеона на месте.
 * Строка типа `TaskCompletion` — исключение: ведёт в карточку самой задачи (`TaskDetailsPanel`),
 * не в детализацию начисления (`openLineDetails`, часть `useSalaryAccrualDocumentPage()`, сама
 * решает, какую из панелей открыть — `deriveLineTaskId`). `openLine`/`openTaskId` — та же строка
 * документа целиком (не просто `id`)/id связанной задачи, оба уже есть в загруженном документе,
 * отдельного запроса к API для выбора панели не нужно.
 */
export function SalaryAccrualDocumentPageMediator() {
    const {
        document,
        direction,
        directionLabel,
        periodLabel,
        departmentName,
        progress,
        openLine,
        openTaskId,
        openLineDetails,
        closeLineDetails,
        closeTaskDetails,
        footerNote,
        footerNoteMobile,
        footerTotal,
        goBackToList,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
    } = useSalaryAccrualDocumentPage()

    const body = (
        <SalaryAccrualDocumentBody
            document={document}
            directionLabel={directionLabel}
            periodLabel={periodLabel}
            departmentName={departmentName}
            progress={progress}
            onOpenLine={openLineDetails}
            footerNote={footerNote}
            footerNoteMobile={footerNoteMobile}
            footerTotal={footerTotal}
            onBack={goBackToList}
        />
    )

    return (
        <>
            <Layout
                isInitialLoad={isInitialLoad}
                isRefreshing={isRefreshing}
                dataVersion={dataVersion}
                error={error}
                body={body}
            />

            <AccrualLineDetailsPanel
                line={openLine}
                direction={document?.direction ?? direction}
                open={openLine !== null}
                onClose={closeLineDetails}
            />

            <TaskDetailsPanel taskId={openTaskId} onClose={closeTaskDetails} />
        </>
    )
}
