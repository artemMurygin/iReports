import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { TaskStatusBadge } from '@/shared/ui-kit/atoms/TaskStatusBadge.tsx'

import type { SalaryReportRule } from '@/features/SalaryReportData'

import { pluralizeDocuments } from '../model/pluralizeDocuments.ts'

export type RuleDetailSectionProps = {
    rule: SalaryReportRule
    className?: string
}

type RuleSource = SalaryReportRule['sources'][number]

const DEFAULT_VISIBLE_COUNT = 5

/** Fallback для источников без описания устройства — задача/позиция отгрузки МойСклад сегодня не
 * несут ни бренда, ни модели. Тот же словарь, что и у старой `RuleSourcesRail`/`pages/SalaryReport/
 * ui/RuleSources.tsx` (не переиспользован напрямую — `pages` не может импортировать другую `pages`,
 * `boundaries/dependencies`). */
const SOURCE_TYPE_LABELS: Record<string, string> = {
    order: 'Заказ',
    serviceOrderItem: 'Позиция услуги',
    taskCompletion: 'Задача',
    demandPosition: 'Позиция отгрузки',
}

function getSourceTypeLabel(type: string): string {
    return SOURCE_TYPE_LABELS[type] ?? type
}

/** Наименование модели устройства ("Apple iPhone 12 Pro, Space Gray") — brand + deviceModel +
 * deviceColor источника-заказа RemOnline. `null` — источник не заказ/позиция заказа, либо ERP не
 * отдал ни одного из этих полей. */
function composeDeviceName(source: RuleSource): string | null {
    const parts = [source.brand, source.deviceModel].filter(Boolean)
    if (parts.length === 0) return null
    const name = parts.join(' ')
    return source.deviceColor ? `${name}, ${source.deviceColor}` : name
}

/** Единственная строка описания заказа под колонкой "Услуга" (Pencil `fGbpF`'s `D`) — в отличие от
 * старой `RuleSourcesRail` (основной лейбл + вторая мелкая строка меты), новая раскладка отводит под
 * заказ одну строку в 30px, так что оба куска (`itemName`/наименование устройства и неисправность)
 * сведены через " · " в один текст вместо стека из двух. */
function composeDescription(source: RuleSource): string {
    const deviceName = composeDeviceName(source)
    const primary = source.itemName ?? deviceName ?? getSourceTypeLabel(source.type)
    const malfunction = primary !== deviceName ? (source.malfunction ?? null) : null
    return [primary, malfunction].filter(Boolean).join(' · ')
}

/**
 * replace-bitrix-task-integration, tasks.md группа 15: статус бейджа источника `taskCompletion` —
 * НЕ поле API, а доменный инвариант `TaskCompletion.calculate()`/`TaskCompletionShop.calculate()`,
 * гарантирующий, что источник `taskCompletion` попадает в `sources[]` только когда связанная задача
 * в статусе `CLOSED_SUCCESSFULLY` (см. прежнюю `RuleSourcesRail`, откуда перенесена эта константа и
 * инвариант дословно).
 */
const TASK_COMPLETION_SOURCE_STATUS = 'CLOSED_SUCCESSFULLY' as const

/**
 * Одна секция правила в панели детализации роли/задачи (Pencil: `design/sallary-first-iteration.pen`,
 * узел `fGbpF` "Панель · Детализация роли" → `OLrmy`/`L0yHTM`/`Md8jI`/`AP5kT` "Правило · …") —
 * заменяет прежнюю пару `LedgerRuleRow`+`RuleSourcesRail` (тот же разворот по клику на заголовок, но
 * заголовок и таблица заказов переверстаны под новую плотную раскладку: тёмная шапка колонок вместо
 * серой, колонки "Заказ / Услуга / Факт / Прогноз" вместо "Позиция / Факт / Прогноз", ссылка
 * "Показать ещё N" без суммы остатка под ней — в макете её нет).
 *
 * Чип рядом с названием правила — количество связанных документов (`pluralizeDocuments`), и
 * ПОКАЗЫВАЕТСЯ ТОЛЬКО когда `sources.length > 0`. Макет рисует для правил без заказов ("Оклад за
 * смену", "Продажа доп. гарантии") чип вида "1 200 ₽ за смену"/"350 ₽ за полис" — это ставка
 * правила, которую отчёт сотруднику НЕ отдаёт (`EmployeeSalaryReportRule` не несёт ни `rate`, ни
 * `salaryBasis`, ни `quantity`, см. contracts/commands/salary-rule.ts) — эти числа в макете
 * иллюстративные, а не выведенные из контракта, поэтому не воспроизводятся здесь (тот же принцип,
 * что и `RuleGroupDetailsPanel`'s JSDoc: "макет — только визуальная основа, не источник полей").
 * По той же причине у таких правил нет и таблицы заказов ниже — разворачивать нечего.
 *
 * Все правила изначально свёрнуты (по прямому запросу пользователя) — отличие от макета, где первые
 * два правила примера нарисованы уже раскрытыми: панель может перечислять много правил с большими
 * таблицами заказов каждое, разворачивать их все сразу при открытии было бы избыточно.
 */
export function RuleDetailSection({ rule, className }: RuleDetailSectionProps) {
    const hasSources = rule.sources.length > 0
    const [isExpanded, setIsExpanded] = useState(false)
    const [showAll, setShowAll] = useState(false)

    const visible = showAll ? rule.sources : rule.sources.slice(0, DEFAULT_VISIBLE_COUNT)
    const hidden = rule.sources.slice(visible.length)

    return (
        <div data-slot="rule-detail-section" className={cn('border-t border-hairline first:border-t-0', className)}>
            <button
                type="button"
                onClick={() => hasSources && setIsExpanded((prev) => !prev)}
                aria-expanded={hasSources ? isExpanded : undefined}
                className={cn(
                    'flex w-full items-center gap-2.5 px-5 py-[11px] text-left',
                    hasSources && 'transition-colors hover:bg-canvas',
                )}
            >
                <ChevronDown
                    className={cn(
                        'size-3.5 shrink-0 text-ink-faint transition-transform duration-150',
                        hasSources && isExpanded ? 'rotate-0' : '-rotate-90',
                    )}
                />
                <span className="min-w-0 flex-1 truncate font-ui text-[13px] font-bold text-ink">{rule.name}</span>
                {hasSources && (
                    <span className="shrink-0 rounded-full border border-hairline bg-canvas px-[7px] py-0.5 font-ui text-[10px] font-semibold whitespace-nowrap text-ink-muted">
                        {pluralizeDocuments(rule.sources.length)}
                    </span>
                )}
                <span className="w-[76px] shrink-0 text-right font-display text-[13px] font-bold text-ink tabular-nums">
                    {formatCurrency(rule.amount.fact)}
                </span>
                <span className="w-[72px] shrink-0 text-right font-display text-xs font-medium text-ink-muted tabular-nums">
                    {rule.amount.prognose === null ? '—' : formatCurrency(rule.amount.prognose)}
                </span>
            </button>

            {hasSources && isExpanded && (
                <div className="flex flex-col">
                    <div className="flex items-center gap-[9px] bg-ink px-5 py-[7px]">
                        <span className="w-[62px] shrink-0 font-ui text-[10px] font-bold tracking-[0.4px] text-surface">
                            Заказ
                        </span>
                        <span className="min-w-0 flex-1 font-ui text-[10px] font-bold tracking-[0.4px] text-surface">
                            Услуга
                        </span>
                        <span className="w-[76px] shrink-0 text-right font-ui text-[10px] font-bold tracking-[0.4px] text-surface">
                            Факт
                        </span>
                        <span className="w-[72px] shrink-0 text-right font-ui text-[10px] font-bold tracking-[0.4px] text-surface">
                            Прогноз
                        </span>
                    </div>

                    {visible.map((source, index) => {
                        const description = composeDescription(source)
                        return (
                            <div
                                key={`${source.type}-${source.id}-${index}`}
                                className="flex min-h-[30px] items-center gap-[9px] px-5"
                            >
                                <span className="w-[62px] shrink-0 truncate font-display text-[11px] font-semibold text-ink">
                                    {source.label ?? String(source.id)}
                                </span>
                                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                    {source.link ? (
                                        <a
                                            href={source.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block min-w-0 truncate font-ui text-xs text-ink hover:underline"
                                        >
                                            {description}
                                        </a>
                                    ) : (
                                        <span className="block min-w-0 truncate font-ui text-xs text-ink">{description}</span>
                                    )}
                                    {source.type === 'taskCompletion' && (
                                        <TaskStatusBadge status={TASK_COMPLETION_SOURCE_STATUS} />
                                    )}
                                </span>
                                <span className="w-[76px] shrink-0 text-right font-display text-xs font-bold text-ink tabular-nums">
                                    {source.amount ? formatCurrency(source.amount.fact) : '—'}
                                </span>
                                <span className="w-[72px] shrink-0 text-right font-display text-xs text-ink-muted tabular-nums">
                                    {source.amount?.prognose == null ? '—' : formatCurrency(source.amount.prognose)}
                                </span>
                            </div>
                        )
                    })}

                    {hidden.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowAll(true)}
                            className="flex items-center gap-1.5 border-t border-hairline bg-canvas px-5 py-2.5 text-left"
                        >
                            <span className="font-ui text-[11px] font-semibold text-info-ink">
                                Показать ещё {pluralizeDocuments(hidden.length)}
                            </span>
                            <ChevronDown className="size-3 shrink-0 text-info-ink" />
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
