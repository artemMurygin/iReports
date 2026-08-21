import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { WorkScheduleShiftEmployee } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'

import { getEmployeeInitials } from '../model/employeeInitials.ts'
import { buildEmployeeScheduleLink } from '../model/employeeScheduleLink.ts'
import { formatHours } from '../model/formatHours.ts'
import { resolveRoleStyle } from '../model/rolePresentation.ts'

export type EmployeeRowProps = {
    employee: WorkScheduleShiftEmployee
    /** Дата смены — та же, что выбрана в ленте недели; нужна только для построения ссылки
     * (`buildEmployeeScheduleLink`), сама строка её не отображает. */
    date: string
    /** `false` для первой строки списка — без разделителя над ней. */
    showDivider: boolean
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` -> `Section На смене` -> `Roster Card`
 * -> `Row *` — аватар (инициалы, цвет роли) + имя/роль + часы + шеврон.
 *
 * Шеврон был визуальным заделом под переход на график сотрудника (Фаза 9a) — теперь вся строка
 * `Link` на десктопную таблицу `/work-schedule` с этим сотрудником (план, Фаза 9: «Переход с
 * карточки сотрудника на его график», см. `model/employeeScheduleLink.ts`).
 */
export function EmployeeRow({ employee, date, showDivider }: EmployeeRowProps) {
    const style = resolveRoleStyle(employee.role)

    return (
        <>
            {showDivider ? <div className="h-px w-full shrink-0 bg-hairline" /> : null}
            <Link
                to={buildEmployeeScheduleLink(employee.employeeId, date)}
                className="flex w-full items-center gap-2.5 px-3 py-2 transition-colors hover:bg-canvas"
            >
                <Avatar>
                    <AvatarFallback className={cn(style.bgClassName, style.textClassName)}>
                        {getEmployeeInitials(employee.name)}
                    </AvatarFallback>
                </Avatar>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-ui text-[13px] font-semibold text-ink">{employee.name}</span>
                    <span className="truncate font-ui text-[11px] text-ink-muted">{style.label}</span>
                </div>

                <span className="shrink-0 font-ui text-[13px] font-semibold text-ink">
                    {employee.hours !== null ? `${formatHours(employee.hours)} ч` : '—'}
                </span>

                <ChevronRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
            </Link>
        </>
    )
}
