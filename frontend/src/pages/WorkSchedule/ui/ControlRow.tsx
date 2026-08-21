import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TargetOption } from '@/features/TargetDirectory'

import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import { shiftMonth } from '../model/format.ts'

const ALL_DEPARTMENTS_VALUE = 'all'

export type ControlRowProps = {
    month: string
    onMonthChange: (month: string) => void
    periodLabel: string
    departments: TargetOption[]
    departmentId: number | null
    onDepartmentIdChange: (id: number | null) => void
    isDepartmentsLoading: boolean
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w` -> `Control Row` -> `Period Nav`
 * (стрелки назад/вперёд вокруг подписи месяца, `surface`-заливка, `hairline` рамка). Дизайн этого
 * узла не показывает фильтр по отделу вовсе (см. чтение design-Cko6w-calendar.html — ни в этом
 * узле, ни в `vO4tI`/`A5SbT` нет упоминания «отдел» как элемента управления), но PRD явно требует
 * его в этой фазе («Руководитель фильтрует таблицу по отделу», критерий готовности задачи "Фаза 6"
 * плана). Добавлен вторым элементом ряда как отдельный `Select`, тем же паттерном (атом +
 * `useDepartments`), что и `SchemaListFilters` (`pages/SalaryRuleList`) — единственное
 * содержательное отклонение этой страницы от узла `Cko6w`.
 *
 * Узел `Cko6w` также показывает здесь «Mode Tabs» (Календарь/Роли) и кнопку «Проставить на 3
 * месяца» — оба явно вне скоупа этой фазы (план: "без... вкладки «Роли»"; PRD, "Не в скоупе":
 * кнопка автозаполнения) и поэтому не отрисовываются вообще, а не как задизейбленные заглушки —
 * не показывать пользователю действие, которое ничего не делает.
 */
function ControlRow({
    month,
    onMonthChange,
    periodLabel,
    departments,
    departmentId,
    onDepartmentIdChange,
    isDepartmentsLoading,
    className,
}: ControlRowProps) {
    return (
        <div data-slot="work-schedule-control-row" className={className}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Select
                    value={departmentId !== null ? String(departmentId) : ALL_DEPARTMENTS_VALUE}
                    onValueChange={(value) => onDepartmentIdChange(value === ALL_DEPARTMENTS_VALUE ? null : Number(value))}
                    disabled={isDepartmentsLoading}
                >
                    <SelectTrigger className="w-[200px]">
                        <span className="text-ink-muted">Отдел:&nbsp;</span>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_DEPARTMENTS_VALUE}>все</SelectItem>
                        {departments.map((department) => (
                            <SelectItem key={department.id} value={String(department.id)}>
                                {department.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-hairline bg-surface p-[3px]">
                    <IconButton
                        size="sm"
                        onClick={() => onMonthChange(shiftMonth(month, -1))}
                        aria-label="Предыдущий месяц"
                    >
                        <ChevronLeft />
                    </IconButton>
                    <span className="min-w-[92px] px-2 text-center font-ui text-[13px] font-medium text-ink capitalize tabular-nums">
                        {periodLabel}
                    </span>
                    <IconButton size="sm" onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label="Следующий месяц">
                        <ChevronRight />
                    </IconButton>
                </div>
            </div>
        </div>
    )
}

export { ControlRow }
