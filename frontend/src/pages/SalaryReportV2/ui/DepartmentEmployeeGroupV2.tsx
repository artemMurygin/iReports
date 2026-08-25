import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { DepartmentSalaryReportEmployee } from 'ireports-contracts'

import { formatCurrency } from '@/features/SalesPlan'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'

import { getRoleLabel } from '@/features/SalaryReportData'

/** Общая ширина колонок "Факт, ₽"/"Прогноз, ₽" — единая для заголовка (`DepartmentLedgerV2`),
 * строки сотрудника и строки правила, чтобы суммы выстраивались в столбик по всей карточке
 * (Pencil: 160px десктоп / 80px мобайл, `esWbE`/`p5Ovs`/`WMePC`/`SbzmJ`). */
export const AMOUNT_COLUMN_CLASS = 'w-20 shrink-0 text-right md:w-40'

/** Хвостовая 20px-колонка статичного индикатора-шеврона (Pencil-диф: `chevron-right` вместо пары
 * "разворот + ArrowUpRight-ссылка", `bTQuD/U6eye`) — общая ширина для заголовка колонок
 * (`DepartmentLedgerV2`, невидимый спейсер `aria-hidden`), строки правила (`RuleRow`, тот же
 * невидимый спейсер) и строки сотрудника ниже (видимый `ChevronRight`), чтобы суммы Факт/Прогноз
 * выстраивались в столбик по всей карточке независимо от того, есть ли в конкретной строке сам
 * индикатор. Внутри группы Факт/Прогноз (`<span className="flex shrink-0 items-center">`, БЕЗ
 * собственного `gap` между детьми) — не обычный ребёнок строки с её `gap-3`, иначе унаследованный
 * `gap` добавил бы спейсеру лишний отступ, которого у видимого шеврона нет. */
export const ROW_ACTION_COL_CLASS = 'flex w-5 shrink-0 items-center justify-center'

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
}

function getEmployeeRoleLabel(employee: DepartmentSalaryReportEmployee): string | null {
    const role = employee.rules[0]?.targetRole
    return role ? getRoleLabel(role) : null
}

function formatAmountOrDash(value: number | null): string {
    return value === null ? '—' : formatCurrency(value)
}

export type DepartmentEmployeeGroupV2Props = {
    employee: DepartmentSalaryReportEmployee
}

/**
 * Один сотрудник в карточке-гроссбухе отдела: кликабельная строка-сводка (Pencil `yP0M7`-подобные
 * узлы, "Сотрудник · {name}") — целиком ссылка на отдельный отчёт этого сотрудника
 * (`/salaries/employee/:id`). По умолчанию строка плоская — без левого акцент-бордера и без фоновой
 * заливки, только нижний hairline-разделитель общего `div`; заливка `$row-selected` (без левого
 * бордера) появляется на hover (Pencil-диф: пример hover-состояния — `F5DRp`, `fill=$row-selected`,
 * vs обычные строки без `fill`).
 *
 * Хвостовая пара "кнопка-разворот правил + отдельная icon-кнопка-ссылка ArrowUpRight" старого
 * макета заменена на один статичный индикатор `ChevronRight` в отдельной 20px-колонке (Pencil-диф,
 * `bTQuD/U6eye`) — редизайн по узлу `SozIO` убирает у отчёта отдела инлайн-разворот правил под
 * строкой сотрудника (там теперь один хвостовой элемент, не два) в пользу перехода на отдельный
 * отчёт сотрудника, где те же правила уже показаны детальнее (карточка-гроссбух с направлениями,
 * `LedgerCard`) — `ChevronRight` (а не `ChevronDown`, как у сворачиваемых блоков/строк правил) здесь
 * читается как «вперёд, на другую страницу», не «развернуть на месте». Клик по всей строке — это
 * навигация (`<Link>`), а не toggle: держать оба поведения на одном клике было бы неоднозначно для
 * пользователя. Это тот самый переход, ради которого и была задача "вся навигация через отдел
 * сначала" (см. `docs/salary-department-first-navigation`) — без него со страницы отдела нельзя
 * попасть на отчёт конкретного сотрудника.
 */
export function DepartmentEmployeeGroupV2({ employee }: DepartmentEmployeeGroupV2Props) {
    const roleLabel = getEmployeeRoleLabel(employee)
    const roleAndCount = [roleLabel, pluralizeRules(employee.rules.length)].filter(Boolean).join(' · ')

    return (
        <div data-slot="department-employee-group-v2" className="border-b border-hairline last:border-b-0">
            <Link
                to={`/salaries/employee/${employee.employeeId}`}
                className="group flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-row-selected md:px-5 md:py-[11px]"
            >
                <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="size-6 md:size-8">
                        <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate font-ui text-sm font-bold text-ink md:text-base">{employee.name}</span>
                        <span className="truncate font-ui text-[11px] text-ink-muted">{roleAndCount}</span>
                    </span>
                </span>

                <span className="flex shrink-0 items-center">
                    <span className={cn(AMOUNT_COLUMN_CLASS, 'font-ui text-sm font-bold text-ink tabular-nums md:text-base')}>
                        {formatCurrency(employee.total.fact)}
                    </span>
                    <span
                        className={cn(
                            AMOUNT_COLUMN_CLASS,
                            'font-ui text-sm font-bold text-ink-muted tabular-nums md:text-base',
                        )}
                    >
                        {formatAmountOrDash(employee.total.prognose)}
                    </span>
                    <span className={ROW_ACTION_COL_CLASS}>
                        <ChevronRight className="size-4 text-ink-faint group-hover:text-ink" />
                    </span>
                </span>
            </Link>
        </div>
    )
}
