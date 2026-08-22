import type { SalaryAccrualResponse } from 'ireports-contracts'

import { AccrualLineCardList, AccrualLinesTable, type AccrualProgress } from '@/features/SalaryAccruals'

import { DocumentHeader } from './DocumentHeader.tsx'
import { DocumentPlanFactKpi, type PlanFact } from './DocumentPlanFactKpi.tsx'

export type SalaryAccrualDocumentBodyProps = {
    /** `undefined` после первичной загрузки — документ не пришёл (ошибка уже показана `ErrorLayout`). */
    document: SalaryAccrualResponse | undefined
    directionLabel: string
    periodLabel: string
    departmentName: string | null
    /** `null` — у направления нет данных плана продаж за месяц, блок скрывается. */
    planFact: PlanFact | null
    progress: AccrualProgress
    isLineExpanded: (id: string) => boolean
    onToggleLine: (id: string) => void
    footerNote: string
    footerNoteMobile: string
    footerTotal: string
    onBack: () => void
}

/**
 * Все ветвления страницы документа (медиатор без условного рендера, frontend/CLAUDE.md):
 * шапка + план/факт отдела (если есть данные плана) + таблица строк (`jb7fL`, `md:` и
 * выше) / карточки строк (`wYi5o`, ниже `md:`).
 */
export function SalaryAccrualDocumentBody({
    document,
    directionLabel,
    periodLabel,
    departmentName,
    planFact,
    progress,
    isLineExpanded,
    onToggleLine,
    footerNote,
    footerNoteMobile,
    footerTotal,
    onBack,
}: SalaryAccrualDocumentBodyProps) {
    if (document === undefined) return null

    return (
        <div className="flex flex-col gap-4">
            <DocumentHeader
                document={document}
                directionLabel={directionLabel}
                periodLabel={periodLabel}
                departmentName={departmentName}
                progress={progress}
                onBack={onBack}
            />

            {planFact !== null && (
                <DocumentPlanFactKpi planFact={planFact} directionLabel={directionLabel} periodLabel={periodLabel} />
            )}

            <AccrualLinesTable
                lines={document.lines}
                isLineExpanded={isLineExpanded}
                onToggleLine={onToggleLine}
                footerNote={footerNote}
                footerTotal={footerTotal}
                className="hidden md:block"
            />
            <AccrualLineCardList
                lines={document.lines}
                isLineExpanded={isLineExpanded}
                onToggleLine={onToggleLine}
                footerNote={footerNoteMobile}
                className="md:hidden"
            />
        </div>
    )
}
