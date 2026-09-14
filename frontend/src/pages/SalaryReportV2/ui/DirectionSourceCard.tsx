import { useMemo } from 'react'
import { ArrowRight, ChevronRight, Info } from 'lucide-react'
import type { SalesPerformanceSummary } from 'ireports-contracts'

import { AccrualStatusBadge } from '@/features/SalaryAccruals'
import { formatCurrency, useShopCategoryNames } from '@/features/SalesPlan'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { cn } from '@/shared/lib/tw'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

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

import { CategoryPlanDonut } from './CategoryPlanDonut.tsx'

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
 * фиолетовый. Экспортирована — `SalesPlanDetailsPanel` (Pencil `BvW3A`) красит той же точкой шапку
 * своей панели детализации плана продаж, чтобы не заводить четвёртую копию этой карты цветов. */
export const DOT_CLASS: Record<SalaryDirection, string> = {
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

/** Доля факта роли в общем факте направления (`clamp(факт роли / факт направления * 100, 0, 100)`)
 * — трек и подпись строки роли показывают структуру начисления направления ("какую долю всей
 * фактической зарплаты направления даёт эта роль"), а не выполнение прогноза самой роли (как было
 * раньше — деление на прогноз роли путало "выполнение плана" с "вкладом в направление", а прогноз
 * роли и так уже показан отдельным числом справа). Факт направления `0` (начислений ещё нет вовсе)
 * — трек остаётся пустым, а не 100%/NaN. */
function calcRoleSharePercent(roleFact: number, directionTotalFact: number): number {
    if (directionTotalFact <= 0) return 0
    return Math.max(0, Math.min(100, (roleFact / directionTotalFact) * 100))
}

const ALL_CATEGORIES_LABEL = 'Все категории'

/** Прогноз по выручке относительно плана категории — та же формула, что и `SalesPlanCategoryRow`'s
 * `forecastPercent` (не переиспользована оттуда напрямую — там она инлайн в JSX компонента строки,
 * а не отдельно экспортируемая функция). 0%, если план категории нулевой (деление на 0 не
 * подменяется на 100%/NaN). */
function calcForecastPercent(summary: SalesPerformanceSummary): number {
    return summary.plan.turnover === 0 ? 0 : Math.round((summary.prognose.turnover / summary.plan.turnover) * 100)
}

type RoleRowProps = {
    group: RuleRoleGroup
    direction: SalaryDirection
    /** Факт направления целиком (`DirectionSourceCard`'s `total.fact`, ТОЛЬКО ролевые правила) —
     * знаменатель доли роли в треке (см. `calcRoleSharePercent`). */
    directionTotalFact: number
    onOpen: () => void
}

/** Одна строка-роль (Pencil: `aB1Lq`/`rfz9M` десктоп — 116px имя + 92px трек + пара 78px колонок
 * факт/прогноз в один ряд; `ORy11`/`F4veQu` мобайл — то же самое в два ряда: "имя + факт" сверху,
 * трек на всю ширину, "прогноз + %" снизу). Клик открывает панель детализации роли
 * (`onOpenRuleGroup`) — это НЕ аккордеон разворота на месте (в отличие от `LedgerRoleGroup` в
 * карточке-гроссбухе слева), поэтому хвостовой индикатор — статичный `ChevronRight`, а не
 * вращающийся `ChevronDown`.
 *
 * Трек/процент — доля факта этой роли в общем факте направления (`calcRoleSharePercent`), не
 * выполнение прогноза самой роли (по прямому запросу пользователя: "статус бар ... должен отражать
 * % от всей фактической зарплаты направления") — прогноз роли по-прежнему показан отдельным числом
 * справа, просто больше не участвует в проценте/треке.
 */
function RoleRow({ group, direction, directionTotalFact, onOpen }: RoleRowProps) {
    const total = sumAllFactPrognose(group.rules.map((rule) => rule.amount))
    const percent = calcRoleSharePercent(total.fact, directionTotalFact)
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

            {/* Десктоп: один ряд — имя / трек / факт / прогноз / шеврон. Имя — единственная
            растягивающаяся колонка (flex-1): она забирает всё свободное место, которое иначе
            осталось бы пустым справа от фиксированных track/факт/прогноз/шеврон, и тем самым не
            обрезает длинные названия ролей раньше, чем реально нужно. */}
            <span className="hidden min-w-0 flex-1 truncate font-ui text-xs text-ink md:block">{label}</span>
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
 * Мини-тизер плана продаж под строками ролей (если `salesPerformance.length > 0`) — горизонтальная
 * лента кольцевых мини-диаграмм по категории (`CategoryPlanDonut`, Pencil: `dhl7h`/`A1xsm`'s
 * `Категории` — `aB1Lq` "Сервис" рисует одну категорию без скролла, `rfz9M` "Магазин" — 7 категорий
 * в горизонтальной прокрутке с fade-маской у правого края) + ссылка "Подробнее", открывающая
 * `SalesPlanDetailsPanel` через `onOpenSalesPlan`. Раньше здесь была компактная сводка через
 * `CellProgress` вместо кольцевых диаграмм — это было ошибочным упрощением (см. историю правок),
 * донат из мокапа визуализирует ту же реальную пару факт/прогноз по каждой категории, а не
 * выдуманную метрику, так что заменять его линейным баром смысла не было.
 */
export function DirectionSourceCard({ direction, onOpenRuleGroup, onOpenSalesPlan, className }: DirectionSourceCardProps) {
    const { roleRules } = splitRulesByType(direction.rules)
    const roleGroups = groupRulesByRole(roleRules, direction.direction)
    const total = sumAllFactPrognose(roleRules.map((rule) => rule.amount))
    const hasSalesPerformance = direction.salesPerformance.length > 0
    const categoryNameById = useShopCategoryNames()

    const categoryDonuts = useMemo(
        () =>
            direction.salesPerformance.map((summary) => ({
                key: summary.category ?? 'all',
                label: summary.category === null ? ALL_CATEGORIES_LABEL : (categoryNameById.get(summary.category) ?? summary.category),
                factPercent: summary.percentCompletion,
                forecastPercent: calcForecastPercent(summary),
            })),
        [direction.salesPerformance, categoryNameById],
    )

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
                            directionTotalFact={total.fact}
                            onOpen={() => onOpenRuleGroup(getRoleLabel(group.role), group.rules, direction.direction)}
                        />
                    ))}
                </div>
            )}

            {hasSalesPerformance && (
                <div className="flex flex-col gap-3 border-t border-hairline pt-3">
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
                        <Popover>
                            <PopoverTrigger asChild>
                                <IconButton size="sm" aria-label="Как читать диаграмму категории">
                                    <Info />
                                </IconButton>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="flex flex-col gap-1.5">
                                <p className="font-ui text-[13px] font-semibold text-ink">Как читать диаграмму</p>
                                <p className="font-ui text-xs text-ink-muted">
                                    Внутреннее кольцо — выполнение плана по факту, внешнее — прогноз к концу
                                    периода. Число в центре — % выполнения по факту.
                                </p>
                            </PopoverContent>
                        </Popover>
                        <button
                            type="button"
                            onClick={() => onOpenSalesPlan(direction.direction)}
                            className="ml-auto flex items-center gap-1 font-ui text-[11px] font-semibold text-info-ink hover:underline"
                        >
                            Подробнее
                            <ArrowRight className="size-3 shrink-0" />
                        </button>
                    </div>

                    <div className="relative">
                        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {categoryDonuts.map((donut) => (
                                <CategoryPlanDonut
                                    key={donut.key}
                                    label={donut.label}
                                    factPercent={donut.factPercent}
                                    forecastPercent={donut.forecastPercent}
                                />
                            ))}
                        </div>
                        {categoryDonuts.length > 4 && (
                            <div
                                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent"
                                aria-hidden
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
