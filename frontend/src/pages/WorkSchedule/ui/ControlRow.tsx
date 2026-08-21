import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TargetOption } from '@/features/TargetDirectory'

import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'
import { SegmentedControl } from '@/shared/ui-kit/atoms/SegmentedControl'

import { shiftMonth } from '../model/format.ts'
import { WORK_SCHEDULE_TAB_OPTIONS, type WorkScheduleTab } from '../model/tabs.ts'

const ALL_DEPARTMENTS_VALUE = 'all'

export type ControlRowProps = {
    month: string
    onMonthChange: (month: string) => void
    periodLabel: string
    departments: TargetOption[]
    departmentId: number | null
    onDepartmentIdChange: (id: number | null) => void
    isDepartmentsLoading: boolean
    tab: WorkScheduleTab
    onTabChange: (tab: WorkScheduleTab) => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w`/`vO4tI` -> `Control Row`. Слева —
 * «Mode Tabs» (Фаза 8: переключатель «Календарь»/«Роли», см. `model/tabs.ts`), реализован через
 * общий UI Kit'овый `SegmentedControl` (тот же атом, что и «Direction Tabs» на `SalesPlanPage`) —
 * его токены (`canvas`-трек, `surface`-пилюля) не пиксель-в-пиксель совпадают с `Mode Tabs`
 * дизайна (там трек `#E6E7E9`/10px радиус вместо `hairline`/8px), но это устоявшийся в проекте
 * компонент для этого паттерна, и заводить вторую копию ради 2px разницы избыточно. Справа —
 * «Period Nav» (стрелки назад/вперёд вокруг подписи месяца, `surface`-заливка, `hairline` рамка).
 *
 * Дизайн не показывает фильтр по отделу вовсе (см. чтение design-Cko6w-calendar.html/
 * design-vO4tI-roles.html — ни в одном из двух узлов нет упоминания «отдел» как элемента
 * управления), но PRD явно требует его («Руководитель фильтрует таблицу по отделу», критерий
 * готовности задачи "Фаза 6" плана). Добавлен рядом с `Period Nav` как отдельный `Select`, тем же
 * паттерном (атом + `useDepartments`), что и `SchemaListFilters` (`pages/SalaryRuleList`) —
 * единственное содержательное отклонение этой страницы от дизайна.
 *
 * Кнопка «Проставить на 3 месяца» (`Cko6w`) — явно вне скоупа (PRD, "Не в скоупе") и поэтому не
 * отрисовывается вообще, а не как задизейбленная заглушка — не показывать пользователю действие,
 * которое ничего не делает.
 */
function ControlRow({
    month,
    onMonthChange,
    periodLabel,
    departments,
    departmentId,
    onDepartmentIdChange,
    isDepartmentsLoading,
    tab,
    onTabChange,
    className,
}: ControlRowProps) {
    return (
        <div data-slot="work-schedule-control-row" className={className}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                    options={WORK_SCHEDULE_TAB_OPTIONS}
                    value={tab}
                    onValueChange={onTabChange}
                    aria-label="Режим отображения графика"
                    className="w-fit"
                />

                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        value={departmentId !== null ? String(departmentId) : ALL_DEPARTMENTS_VALUE}
                        onValueChange={(value) =>
                            onDepartmentIdChange(value === ALL_DEPARTMENTS_VALUE ? null : Number(value))
                        }
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
                        <IconButton
                            size="sm"
                            onClick={() => onMonthChange(shiftMonth(month, 1))}
                            aria-label="Следующий месяц"
                        >
                            <ChevronRight />
                        </IconButton>
                    </div>
                </div>
            </div>
        </div>
    )
}

export { ControlRow }
