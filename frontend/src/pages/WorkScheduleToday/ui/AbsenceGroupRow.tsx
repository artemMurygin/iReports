import { Link } from 'react-router-dom'
import type { WorkScheduleAbsenceGroup } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { resolveAbsenceReasonStyle } from '../model/absenceReasonPresentation.ts'
import { buildEmployeeScheduleLink } from '../model/employeeScheduleLink.ts'

export type AbsenceGroupRowProps = {
    group: WorkScheduleAbsenceGroup
    date: string
    /** `false` для первой строки карточки — без разделителя над ней. */
    showDivider: boolean
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` -> `Section Не на смене` -> `Absence
 * Card` -> `Row *` — бейдж причины + имена одной строкой («Илья Ковалёв, Анна Лебедева, ...»).
 *
 * Дизайн рисует `Names` простым текстовым узлом, но план требует тап по каждому отсутствующему
 * («Переход с карточки сотрудника на его график» — критерий один на весь список, без исключения
 * для «не на смене», см. задачу шага). Поэтому здесь не текст, а разделённый запятыми ряд
 * `Link`-ов — то же построчное чтение, что и в макете, но каждое имя кликабельно по отдельности.
 */
export function AbsenceGroupRow({ group, date, showDivider }: AbsenceGroupRowProps) {
    const style = resolveAbsenceReasonStyle(group.reason)

    return (
        <>
            {showDivider ? <div className="h-px w-full shrink-0 bg-hairline" /> : null}
            <div className="flex w-full items-center gap-2.5 px-3 py-[9px]">
                <span
                    className={cn(
                        'flex w-[92px] shrink-0 items-center justify-center rounded-[6px] border border-hairline px-[7px] py-[3px] font-ui text-[10.5px] font-semibold',
                        style.bgClassName,
                        style.textClassName,
                    )}
                >
                    {style.label}
                </span>

                <p className="min-w-0 flex-1 font-ui text-[11.5px] leading-[16px] text-ink">
                    {group.employees.map((employee, index) => (
                        <span key={employee.employeeId}>
                            {index > 0 ? ', ' : ''}
                            <Link to={buildEmployeeScheduleLink(employee.employeeId, date)} className="hover:underline">
                                {employee.name}
                            </Link>
                        </span>
                    ))}
                </p>
            </div>
        </>
    )
}
