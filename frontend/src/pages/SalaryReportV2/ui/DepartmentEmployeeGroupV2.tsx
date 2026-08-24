import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { DepartmentSalaryReportEmployee } from 'ireports-contracts'

import { formatCurrency } from '@/features/SalesPlan'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Button } from '@/shared/ui-kit/atoms/Button'

import { getRoleLabel, isFloatPercentRule, type SalaryDirection, type SalaryReportRule } from '@/features/SalaryReportData'

import { getRuleRate } from '../model/ruleRate.ts'

/** Точка-индикатор строки правила — по направлению, тот же приём и токены, что у отчёта сотрудника
 * (`LedgerRuleRow.tsx`'s `DOT_CLASS`). Одноцветная (`bg-brand-strong`) в обычном режиме (отчёт
 * отдела на бэкенде однонаправлен — `rule.direction` не проставлен); красится по направлению,
 * только когда строка пришла из сведённого отчёта «Все» (`useDepartmentSalaryReportAll` метит
 * каждое правило направлением, из которого оно получено, — см. `SalaryReportRuleWithDirection`),
 * чтобы вперемешку идущие правила Сервиса/Магазина не выглядели одним и тем же источником. */
const DOT_CLASS: Record<SalaryDirection, string> = {
    service: 'bg-brand-strong',
    shop: 'bg-violet-ink',
}

/** Общая ширина колонок "Факт, ₽"/"Прогноз, ₽" — единая для заголовка (`DepartmentLedgerV2`),
 * строки сотрудника и строки правила, чтобы суммы выстраивались в столбик по всей карточке
 * (Pencil: 160px десктоп / 80px мобайл, `esWbE`/`p5Ovs`/`WMePC`/`SbzmJ`). */
export const AMOUNT_COLUMN_CLASS = 'w-20 shrink-0 text-right md:w-40'

/** Хвостовая колонка кнопки-перехода к отчёту сотрудника — та же ширина/отступ, что и у самой
 * `<Button variant="ghost" size="icon">` ниже (`size-8` + `mr-1.5`/`md:mr-2`), которая в строке
 * сотрудника стоит СНАРУЖИ кнопки-разворота, без зазора от общего `gap` строки. Заголовок колонок
 * и строки правил такого элемента не имеют — на них этот же спейсер добавляется невидимым `<span>`
 * ВНУТРИ группы Факт/Прогноз (`<span className="flex shrink-0 items-center">...</span>`, без
 * собственного `gap` между её детьми), а НЕ как обычный ребёнок строки с её `gap-3`: иначе
 * унаследованный от строки `gap-3` добавил бы спейсеру лишний отступ, которого у настоящей кнопки
 * нет (она вне gap-контекста), и колонки съехали бы на разницу — тот же приём, что
 * `LEDGER_CHEVRON_COL` у отчёта сотрудника (`model/ledgerColumns.ts`), но там чеврон — обычный
 * ребёнок строки, а не член no-gap группы, потому что там нет отдельно стоящей кнопки вне строки. */
export const ROW_ACTION_COL_CLASS = 'mr-1.5 size-8 shrink-0 md:mr-2'

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

/** Строка правила (Pencil `WVNGR`-подобные узлы, "Правило") — точка-индикатор + название + мета,
 * суммы факт/прогноз каждая со своей "Ставкой" под значением. Ставка — только для KPI-правил
 * (общий `getRuleRate`, см. `model/ruleRate.ts`, тот же хелпер, что и у `LedgerRuleRow` строки
 * отчёта сотрудника), вызывается только на KPI-ветке: фиксированные правила намеренно не рендерят
 * вторую строку под суммой — контракт не отдаёт для них ни ставку за единицу, ни количество
 * единиц как отдельные поля отчёта (см. `DepartmentReportBodyV2.types.ts`'s комментарий; `getRuleRate`
 * для фикс-ставки восстанавливает "N ₽ × M" делением уже загруженных сумм — тот приём здесь
 * намеренно не используется, чтобы не показывать в отчёте отдела то, чего нет в его макете). */
function RuleRow({
    rule,
    isClosed,
    isLast,
}: {
    rule: SalaryReportRule & { direction?: SalaryDirection }
    isClosed: boolean
    isLast: boolean
}) {
    const metaLabel = isFloatPercentRule(rule) ? 'Плавающий процент · KPI' : 'Фиксированная ставка'
    const rate = isFloatPercentRule(rule) ? getRuleRate(rule, isClosed) : null
    const dotClass = rule.direction ? DOT_CLASS[rule.direction] : 'bg-brand-strong'

    return (
        <div
            data-slot="department-rule-row-v2"
            className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5 md:px-5 md:py-3',
                !isLast && 'border-b border-hairline',
            )}
        >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                    <span className={cn('size-1.5 shrink-0 rounded-full', dotClass)} />
                    <span className="truncate font-ui text-[13px] font-semibold text-ink">{rule.name}</span>
                </span>
                <span className="truncate font-ui text-[11px] text-ink-muted">{metaLabel}</span>
            </span>

            {/* Факт/Прогноз/спейсер — БЕЗ зазора между собой (в отличие от `gap-3` всей строки),
                тем же приёмом, что и `amounts`-обёртка строки сотрудника ниже: спейсер должен
                примыкать к "Прогноз" вплотную, иначе унаследованный `gap-3` добавит ему лишний
                отступ, которого нет у настоящей кнопки-иконки в строке сотрудника (см.
                `ROW_ACTION_COL_CLASS`). */}
            <span className="flex shrink-0 items-center">
                <span className={cn(AMOUNT_COLUMN_CLASS, 'flex flex-col items-end gap-0.5')}>
                    <span className="font-ui text-sm font-bold text-ink tabular-nums">{formatCurrency(rule.amount.fact)}</span>
                    {rate && <span className="font-ui text-[11px] text-ink-muted">{rate.fact}</span>}
                </span>
                <span className={cn(AMOUNT_COLUMN_CLASS, 'flex flex-col items-end gap-0.5')}>
                    <span className="font-ui text-sm font-bold text-ink-muted tabular-nums">
                        {formatAmountOrDash(rule.amount.prognose)}
                    </span>
                    {rule.amount.prognose !== null && rate?.prognose && (
                        <span className="font-ui text-[11px] text-ink-muted">{rate.prognose}</span>
                    )}
                </span>
                <span className={ROW_ACTION_COL_CLASS} aria-hidden />
            </span>
        </div>
    )
}

export type DepartmentEmployeeGroupV2Props = {
    employee: DepartmentSalaryReportEmployee
    isClosed: boolean
    expanded: boolean
    onToggle: () => void
}

/**
 * Один сотрудник в карточке-гроссбухе отдела: кликабельная строка-сводка (Pencil `yP0M7`-подобные
 * узлы, "Сотрудник · {name}" — `brand-soft` заливка + левый акцент-бордер `brand-strong`) плюс,
 * если развёрнута, плоский список его правил сразу под ней (`RuleRow`). Разворот
 * (`isEmployeeExpanded`/`onToggleEmployee` по ключу `employee.employeeId`) и переход на отдельный
 * отчёт сотрудника (`/salaries/employee/:id`, свой URL — см. `useSalaryReportPage.ts`'s
 * комментарий) — два НЕЗАВИСИМЫХ действия в одной строке, поэтому не единая кнопка (как было
 * раньше, у узла нет отдельной иконки-шеврона), а кнопка-разворот на большую часть строки + ссылка-
 * иконка справа (тот же приём, что и `pages/DepartmentBalances/ui/DepartmentBalancesTable.tsx`'s
 * «Открыть баланс»): вложить `<Link>` внутрь `<button>` нельзя (невалидный HTML), поэтому оба —
 * соседние элементы внутри общего оформленного `div`.
 */
export function DepartmentEmployeeGroupV2({ employee, isClosed, expanded, onToggle }: DepartmentEmployeeGroupV2Props) {
    const roleLabel = getEmployeeRoleLabel(employee)
    const roleAndCount = [roleLabel, pluralizeRules(employee.rules.length)].filter(Boolean).join(' · ')

    return (
        <div data-slot="department-employee-group-v2" className="border-b border-hairline last:border-b-0">
            <div className="flex items-stretch border-l-4 border-brand-strong bg-brand-soft transition-colors hover:brightness-[0.98]">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left md:px-5 md:py-[11px]"
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
                    </span>
                </button>

                <Button variant="ghost" size="icon" asChild className="my-1.5 mr-1.5 shrink-0 md:my-2 md:mr-2">
                    <Link to={`/salaries/employee/${employee.employeeId}`} aria-label={`Открыть отчёт сотрудника ${employee.name}`}>
                        <ArrowUpRight />
                    </Link>
                </Button>
            </div>

            {expanded &&
                employee.rules.map((rule, index) => (
                    <RuleRow key={`${rule.ruleId}-${index}`} rule={rule} isClosed={isClosed} isLast={index === employee.rules.length - 1} />
                ))}
        </div>
    )
}
