import { SalaryRuleDetailsPanel } from '@/features/SalaryRuleDetailsPanel'

import { useSalaryAccrualDocumentPage } from '../model/useSalaryAccrualDocumentPage.ts'
import { useSalaryRulePanel } from '../model/useSalaryRulePanel.ts'
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
 * Переход из `ui/SalaryAccrualDocumentPage.tsx` в `mediator/SalaryAccrualDocumentPageMediator.tsx`
 * — по образцу `pages/Tasks/mediator/TasksPageMediator.tsx` (frontend/CLAUDE.md, «Mediator-компонент
 * для страниц с несколькими виджетами»): раньше на странице был единственный stateful-виджет
 * (`useSalaryAccrualDocumentPage()`), теперь клик по строке начисления открывает вторую независимую
 * боковую панель (`features/SalaryRuleDetailsPanel`) со статическим описанием её правила —
 * `useSalaryAccrualDocumentPage()` (документ/строки/аккордеон источников) и `useSalaryRulePanel()`
 * (какое правило открыто) не знают друг о друге, их единственная связь — колбэк `onOpenRule`,
 * прокинутый в `SalaryAccrualDocumentBody` -> `AccrualLinesTable`/`AccrualLineCardList`.
 *
 * `direction` для панели берётся из уже загруженного документа (`document.direction`), а не из
 * query-параметра страницы — `onOpenRule` вызывается только по клику на реально отрендеренную
 * строку, то есть документ на этот момент гарантированно загружен; `direction`-хука страницы
 * остаётся резервным значением на случай (в норме не наступающий) вызова до загрузки.
 */
export function SalaryAccrualDocumentPageMediator() {
    const {
        document,
        direction,
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

    const { openRuleRef, openRule, closeRule } = useSalaryRulePanel()

    function onOpenRule(ruleId: string) {
        openRule({ ruleId, direction: document?.direction ?? direction })
    }

    const body = (
        <SalaryAccrualDocumentBody
            document={document}
            directionLabel={directionLabel}
            periodLabel={periodLabel}
            departmentName={departmentName}
            progress={progress}
            isLineExpanded={isLineExpanded}
            onToggleLine={toggleLine}
            onOpenRule={onOpenRule}
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

            <SalaryRuleDetailsPanel {...openRuleRef} onClose={closeRule} />
        </>
    )
}
