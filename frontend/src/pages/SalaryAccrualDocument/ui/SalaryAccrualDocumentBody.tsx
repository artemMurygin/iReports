import type { SalaryAccrualResponse } from 'ireports-contracts'

import { AccrualLineCardList, AccrualLinesTable, type AccrualProgress } from '@/features/SalaryAccruals'

import { DocumentHeader } from './DocumentHeader.tsx'

export type SalaryAccrualDocumentBodyProps = {
    /** `undefined` после первичной загрузки — документ не пришёл (ошибка уже показана `ErrorLayout`). */
    document: SalaryAccrualResponse | undefined
    directionLabel: string
    periodLabel: string
    departmentName: string | null
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
 * шапка + таблица строк, сгруппированная по направлению (`jb7fL`/`DQ3tV`, `md:` и выше) / карточки
 * строк (`wYi5o`/`g0onp`, ниже `md:`). Блок план/факт отдела (`DocumentPlanFactKpi`) убран вместе
 * с редизайном — его нет ни в `DQ3tV`, ни в `g0onp` (перепроверено скриншотом), тот же приём, что
 * убрал KPI-строку из списка начислений.
 */
export function SalaryAccrualDocumentBody({
    document,
    directionLabel,
    periodLabel,
    departmentName,
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
                periodLabel={periodLabel}
                departmentName={departmentName}
                progress={progress}
                onBack={onBack}
            />

            <AccrualLinesTable
                lines={document.lines}
                direction={document.direction}
                directionLabel={directionLabel}
                accrualId={document.id}
                documentStatus={document.status}
                isLineExpanded={isLineExpanded}
                onToggleLine={onToggleLine}
                footerNote={footerNote}
                footerTotal={footerTotal}
                className="hidden md:block"
            />
            <AccrualLineCardList
                lines={document.lines}
                direction={document.direction}
                directionLabel={directionLabel}
                accrualId={document.id}
                documentStatus={document.status}
                isLineExpanded={isLineExpanded}
                onToggleLine={onToggleLine}
                footerNote={footerNoteMobile}
                footerTotal={footerTotal}
                className="md:hidden"
            />
        </div>
    )
}
