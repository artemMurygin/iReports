import { ArrowRight, ChevronRight } from 'lucide-react'
import type { FactPrognoseAmount } from 'ireports-contracts'

import { AccrualStatusBadge } from '@/features/SalaryAccruals'
import { formatCurrency, pluralizeCategories } from '@/features/SalesPlan'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { cn } from '@/shared/lib/tw'
import { CellProgress } from '@/shared/ui-kit/molecules/CellProgress.tsx'

import {
    getRoleLabel,
    sumAllFactPrognose,
    type DirectionReportVM,
    type SalaryDirection,
    type SalaryReportRule,
} from '@/features/SalaryReportData'

import { groupRulesByRole, type RuleRoleGroup } from '../model/groupRulesByRole.ts'
import { splitRulesByType } from '../model/groupRulesByType.ts'
import { pluralizeRoles } from '../model/pluralizeRoles.ts'

export type DirectionSourceCardProps = {
    /** Отчёт направления — карточка сама делит `direction.rules` на ролевые/задачные
     * (`splitRulesByType`) и использует ТОЛЬКО ролевые: задачные правила (`TaskCompletion`) уже
     * показывает соседняя карточка «Источник · Задачи», объединяющая их из обоих направлений сразу
     * — эта карточка их не дублирует. */
    direction: DirectionReportVM
    /** Открыть панель детализации группы правил одной роли (`RuleGroupDetailsPanel`) —
     * `title` = `getRoleLabel(role)`, `rules` = все правила этой роли (группа может содержать
     * больше одного правила — это и есть требуемая группировка внутри роли), `direction` — само
     * направление (для цвета точки/строк панели). */
    onOpenRuleGroup: (title: string, rules: SalaryReportRule[], direction: SalaryDirection) => void
    /** Открыть панель детализации плана продаж направления (`SalesPlanDetailsPanel`) — вызывается
     * ссылкой "Подробнее" мини-тизера плана, только когда он показан
     * (`direction.salesPerformance.length > 0`). */
    onOpenSalesPlan: (direction: SalaryDirection) => void
    className?: string
}

/** Точка направления — тот же цвет, что и везде в этой странице (`LedgerRoleGroup`/`LedgerRuleRow`'s
 * `DOT_CLASS`): зелёный `brand-strong` у "Сервис", фиолетовый `violet-ink` у "Магазин". Мокап
 * (`YCxrT`'s `rfz9M`) рисует "Магазин" синим (`#3B82F6`) — не подхвачено намеренно, чтобы карточка
 * не расходилась цветом с остальной карточкой-гроссбухом слева (`LedgerCard`), где "Магазин" уже
 * фиолетовый. */
const DOT_CLASS: Record<SalaryDirection, string> = {
    service: 'bg-brand-strong',
    shop: 'bg-violet-ink',
}

/** Трек прогресса строки роли — тот же цвет, что и точка направления (в отличие от порогового
 * `progressToneClassName` категорий плана продаж, здесь просто фирменный цвет направления, как в
 * мокапе `H7yScw`/`ZeG7Z` (сервис — сплошной `$brand-strong` независимо от процента) — правило
 * заполнения роли не такой же индикатор "хорошо/плохо", как выполнение плана продаж. */
const TRACK_FILL_CLASS: Record<SalaryDirection, string> = {
    service: 'bg-brand-strong',
    shop: 'bg-violet-ink',
}

/** `clamp(факт/прогноз группы * 100, 0, 100)`, прогноз `null`/`0` — считается полностью выполненным
 * (100%): нет числа, на которое можно поделить, а сам факт уже начислен целиком. */
function calcRoleProgressPercent(total: FactPrognoseAmount): number {
    const prognoseValue = total.prognose ?? total.fact
    if (prognoseValue <= 0) return 100
    return Math.max(0, Math.min(100, (total.fact / prognoseValue) * 100))
}

/** "Выполнение плана" направления по обороту (факт/план) — та же формула, что и footer
 * `SalesPlanDetailsPanel` ("Выполнение плана X%"), пересчитана здесь локально для компактного
 * мини-тизера карточки (не переиспользована оттуда напрямую — там она замыкает JSX самого компонента
 * панели, а не отдельно экспортируемая функция). 0%, если план направления нулевой (деление на 0 не
 * подменяется на 100%/NaN). */
function calcPlanCompletionPercent(direction: DirectionReportVM): number {
    const totalFactTurnover = direction.salesPerformance.reduce((sum, row) => sum + row.fact.turnover, 0)
    const totalPlanTurnover = direction.salesPerformance.reduce((sum, row) => sum + row.plan.turnover, 0)
    return totalPlanTurnover === 0 ? 0 : Math.round((totalFactTurnover / totalPlanTurnover) * 100)
}

type RoleRowProps = {
    group: RuleRoleGroup
    direction: SalaryDirection
    onOpen: () => void
}

/** Одна строка-роль (Pencil: `aB1Lq`/`rfz9M` десктоп — 116px имя + 92px трек + пара 78px колонок
 * факт/прогноз в один ряд; `ORy11`/`F4veQu` мобайл — то же самое в два ряда: "имя + факт" сверху,
 * трек на всю ширину, "прогноз + %" снизу). Клик открывает панель детализации роли
 * (`onOpenRuleGroup`) — это НЕ аккордеон разворота на месте (в отличие от `LedgerRoleGroup` в
 * карточке-гроссбухе слева), поэтому хвостовой индикатор — статичный `ChevronRight`, а не
 * вращающийся `ChevronDown`.
 */
function RoleRow({ group, direction, onOpen }: RoleRowProps) {
    const total = sumAllFactPrognose(group.rules.map((rule) => rule.amount))
    const percent = calcRoleProgressPercent(total)
    const prognoseText = total.prognose === null ? '—' : formatCurrency(total.prognose)
    const label = getRoleLabel(group.role)

    return (
        <button
            type="button"
            onClick={onOpen}
            className="flex w-full flex-col gap-1.5 rounded-lg py-1.5 text-left transition-colors hover:bg-canvas md:flex-row md:items-center md:gap-3 md:px-1"
        >
            {/* Мобайл: имя + факт сверху, трек на всю ширину, прогноз + шеврон снизу. */}
            <span className="flex items-center gap-2 md:hidden">
                <span className="min-w-0 flex-1 truncate font-ui text-xs font-semibold text-ink">{label}</span>
                <span className="shrink-0 font-ui text-[13px] font-bold text-ink tabular-nums">
                    {formatCurrency(total.fact)}
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-ink-faint" />
            </span>
            <div className="h-1 w-full overflow-hidden rounded-full bg-hairline md:hidden">
                <div
                    className={cn('h-full rounded-full', TRACK_FILL_CLASS[direction])}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="flex items-center gap-2 md:hidden">
                <span className="truncate font-ui text-[10px] text-ink-faint">прогноз {prognoseText}</span>
                <span className="flex-1" aria-hidden />
                <span className="shrink-0 font-ui text-[10px] font-bold text-ink-muted tabular-nums">
                    {Math.round(percent)}%
                </span>
            </span>

            {/* Десктоп: один ряд — имя / трек / факт / прогноз / шеврон. */}
            <span className="hidden w-[104px] shrink-0 truncate font-ui text-xs text-ink md:block">{label}</span>
            <div className="hidden h-1.5 w-[76px] shrink-0 overflow-hidden rounded-full bg-hairline md:block">
                <div
                    className={cn('h-full rounded-full', TRACK_FILL_CLASS[direction])}
                    style={{ width: `${percent}%` }}
                />
            </div>
            <span className="hidden w-[72px] shrink-0 text-right font-ui text-xs font-bold text-ink tabular-nums md:block">
                {formatCurrency(total.fact)}
            </span>
            <span className="hidden w-[72px] shrink-0 text-right font-ui text-xs font-semibold text-ink-faint tabular-nums md:block">
                {prognoseText}
            </span>
            <ChevronRight className="hidden size-3.5 shrink-0 text-ink-faint md:block" />
        </button>
    )
}

/**
 * Карточка-источник ролевых начислений направления (Pencil: `design/sallary-first-iteration.pen`,
 * узел `YCxrT` "Вариант C · Бенто-источники" -> `aB1Lq`/`rfz9M` десктоп, `L2Ztk` "Вариант C ·
 * Моб. · Бенто-источники" -> `ORy11`/`F4veQu` мобайл) — одна на направление, показывается только
 * если у направления есть хоть одно НЕ-`TaskCompletion` правило (пустая карточка не рендерится,
 * решает вызывающая сторона, собирающая раскладку `EmployeeReportBodyV2`).
 *
 * Шапка — точка направления + `direction.label` + мета "N ролей · M правил" (считая ТОЛЬКО ролевые
 * правила — задачные уже в соседней «Источник · Задачи») + бейдж статуса начисления, если он есть
 * (`direction.accrualStatus`, тот же `AccrualStatusBadge`, что и в `LedgerDirectionBlock`).
 * Сумма — факт/прогноз ТОЛЬКО по ролевым правилам (`sumAllFactPrognose`, НЕ `direction.total`, тот
 * включает и задачные). Строки — по одной на роль (`groupRulesByRole`), клик открывает
 * `RuleGroupDetailsPanel` через `onOpenRuleGroup` с ВСЕЙ группой правил роли (пользователь явно
 * потребовал эту группировку — одна роль может нести несколько зарплатных правил).
 *
 * Мини-тизер плана продаж под строками ролей (если `salesPerformance.length > 0`) — НЕ повторяет
 * донат-визуализацию мокапа по категориям (явный запрет — "не изобретай тяжёлую визуализацию"):
 * вместо неё компактная сводка — переиспользованный `CellProgress` (`compact`, единственный готовый
 * прогресс-индикатор в `shared/ui-kit`, точка выполнения плана по обороту факт/план) + счётчик
 * категорий + ссылка "Подробнее", открывающая `SalesPlanDetailsPanel` через `onOpenSalesPlan`.
 */
export function DirectionSourceCard({ direction, onOpenRuleGroup, onOpenSalesPlan, className }: DirectionSourceCardProps) {
    const { roleRules } = splitRulesByType(direction.rules)
    const roleGroups = groupRulesByRole(roleRules, direction.direction)
    const total = sumAllFactPrognose(roleRules.map((rule) => rule.amount))
    const hasSalesPerformance = direction.salesPerformance.length > 0

    return (
        <div
            data-slot="direction-source-card"
            className={cn('flex flex-col gap-3.5 rounded-xl border border-hairline bg-surface p-4 md:px-5', className)}
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className={cn('size-2 shrink-0 rounded-full', DOT_CLASS[direction.direction])} aria-hidden />
                <span className="truncate font-ui text-sm font-bold text-ink">{direction.label}</span>
                <span className="truncate font-ui text-[11px] text-ink-muted">
                    · {pluralizeRoles(roleGroups.length)} · {pluralizeRules(roleRules.length)}
                </span>
                {direction.accrualStatus !== null && (
                    <AccrualStatusBadge status={direction.accrualStatus} className="ml-auto" />
                )}
            </div>

            <div className="flex items-end justify-between gap-3">
                <span className="font-display text-[26px] font-bold tracking-[-0.3px] text-ink tabular-nums">
                    {formatCurrency(total.fact)}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                    <span className="font-ui text-[10px] text-ink-muted">прогноз</span>
                    <span className="font-ui text-[13px] font-bold text-ink-muted tabular-nums">
                        {total.prognose === null ? '—' : formatCurrency(total.prognose)}
                    </span>
                </div>
            </div>

            {roleGroups.length > 0 && (
                <div className="flex flex-col border-t border-hairline pt-1">
                    {roleGroups.map((group) => (
                        <RoleRow
                            key={group.role}
                            group={group}
                            direction={direction.direction}
                            onOpen={() => onOpenRuleGroup(getRoleLabel(group.role), group.rules, direction.direction)}
                        />
                    ))}
                </div>
            )}

            {hasSalesPerformance && (
                <div className="flex flex-col gap-2 border-t border-hairline pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-ui text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
                            План продаж · {direction.label}
                        </span>
                        <span
                            className={cn(
                                'shrink-0 rounded-md px-2 py-[3px] font-ui text-[10px] font-semibold whitespace-nowrap',
                                direction.isPlanApproved ? 'bg-brand-soft text-ok-ink' : 'bg-warn-soft text-warn-ink',
                            )}
                        >
                            {direction.isPlanApproved ? 'Утверждён' : 'Не утверждён'}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <CellProgress percent={calcPlanCompletionPercent(direction)} size="compact" />
                        <span className="shrink-0 font-ui text-[11px] text-ink-muted">
                            {direction.salesPerformance.length} {pluralizeCategories(direction.salesPerformance.length)}
                        </span>
                        <button
                            type="button"
                            onClick={() => onOpenSalesPlan(direction.direction)}
                            className="flex items-center gap-1 font-ui text-[11px] font-semibold text-info-ink hover:underline"
                        >
                            Подробнее
                            <ArrowRight className="size-3 shrink-0" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
