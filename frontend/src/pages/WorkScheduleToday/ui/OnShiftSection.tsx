import type { WorkScheduleShiftEmployee } from 'ireports-contracts'

import { EmployeeRow } from './EmployeeRow.tsx'
import { formatHours } from '../model/formatHours.ts'

export type OnShiftSectionProps = {
    employees: WorkScheduleShiftEmployee[]
    onShiftCount: number
    totalEmployees: number
    totalHours: number
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` -> `Section На смене` — заголовок
 * «На смене · N из M» + «Часы · N ч» и карточка-ростер сотрудников на смене выбранного дня.
 *
 * Блок «Не на смене» (следующая секция того же узла дизайна) сюда сознательно не входит — задача
 * следующего шага (план, Фаза 9b), не этого.
 */
export function OnShiftSection({ employees, onShiftCount, totalEmployees, totalHours, className }: OnShiftSectionProps) {
    return (
        <section className={className}>
            <div className="flex items-center justify-between gap-2">
                <h2 className="font-ui text-[12.5px] font-semibold text-ink">
                    На смене · {onShiftCount} из {totalEmployees}
                </h2>
                <span className="shrink-0 font-ui text-[11.5px] text-ink-muted">Часы · {formatHours(totalHours)} ч</span>
            </div>

            {employees.length === 0 ? (
                <p className="mt-2 rounded-xl border border-hairline bg-surface px-4 py-6 text-center font-ui text-[13px] text-ink-muted">
                    Сегодня никто не работает
                </p>
            ) : (
                <div className="mt-2 flex flex-col items-start overflow-hidden rounded-xl border border-hairline bg-surface">
                    {employees.map((employee, index) => (
                        <EmployeeRow key={employee.employeeId} employee={employee} showDivider={index > 0} />
                    ))}
                </div>
            )}
        </section>
    )
}
