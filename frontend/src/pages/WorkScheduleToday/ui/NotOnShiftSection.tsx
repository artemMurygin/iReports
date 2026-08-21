import type { WorkScheduleAbsenceGroup } from 'ireports-contracts'

import { notOnShiftCount } from '../model/shiftStats.ts'
import { AbsenceGroupRow } from './AbsenceGroupRow.tsx'

export type NotOnShiftSectionProps = {
    notOnShift: WorkScheduleAbsenceGroup[]
    date: string
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` -> `Section Не на смене` — заголовок
 * «Не на смене · N» + «причины отсутствия» и карточка групп по причине (`Absence Card`).
 *
 * Секция целиком скрывается, когда отсутствующих нет (`notOnShift` пуст — редкий, но возможный
 * день, когда весь отдел вышел на смену): в отличие от `OnShiftSection`, у которой всегда есть
 * заголовок «На смене · 0 из M» даже при пустом ростере, дизайн не предусматривает пустое
 * состояние для этого блока вообще (нет узла-заглушки в `A5SbT`), а рисовать «Не на смене · 0» с
 * пустой карточкой без прецедента в макете — придумывать за дизайнера.
 */
export function NotOnShiftSection({ notOnShift, date, className }: NotOnShiftSectionProps) {
    if (notOnShift.length === 0) return null

    return (
        <section className={className}>
            <div className="flex items-center justify-between gap-2">
                <h2 className="font-ui text-[12.5px] font-semibold text-ink">
                    Не на смене · {notOnShiftCount(notOnShift)}
                </h2>
                <span className="shrink-0 font-ui text-[11.5px] text-ink-muted">причины отсутствия</span>
            </div>

            <div className="mt-2 flex flex-col items-start overflow-hidden rounded-xl border border-hairline bg-surface">
                {notOnShift.map((group, index) => (
                    <AbsenceGroupRow key={group.reason} group={group} date={date} showDivider={index > 0} />
                ))}
            </div>
        </section>
    )
}
