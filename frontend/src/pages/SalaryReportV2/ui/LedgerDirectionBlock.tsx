import { ChevronDown, ShoppingBag, Wrench } from 'lucide-react'

import { AccrualStatusBadge } from '@/features/SalaryAccruals'
import { formatCurrency } from '@/features/SalesPlan'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { cn } from '@/shared/lib/tw'

import type { DirectionReportVM, SalaryDirection } from '@/features/SalaryReportData'

import { LEDGER_CHEVRON_COL, LEDGER_VALUE_COL } from '../model/ledgerColumns.ts'

import { LedgerRuleRow } from './LedgerRuleRow.tsx'

export type LedgerDirectionBlockProps = {
    report: DirectionReportVM
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void
    /** Развёрнут ли блок направления целиком — дефолт задаётся вызывающей стороной (см.
     * `useSalaryReportSelection`'s комментарий: "Сервис" свёрнут, "Магазин" развёрнут), дальше
     * сворачивание переключается кликом по заголовку блока. */
    isExpanded: boolean
    onToggle: () => void
    className?: string
}

const DIRECTION_ICON: Record<SalaryDirection, typeof Wrench> = {
    service: Wrench,
    shop: ShoppingBag,
}

/** Фон/акцент строго по направлению (Pencil `fNwhK`/`TMa9C`) — "Сервис" на общих `brand-*`
 * токенах карточки, "Магазин" на отдельных `violet-*` (см. `shared/ui-kit/tokens/theme.css`'s
 * комментарий рядом с их объявлением). */
const HEADER_CLASS: Record<SalaryDirection, string> = {
    service: 'bg-brand-soft',
    shop: 'bg-violet-soft',
}
const ICON_CLASS: Record<SalaryDirection, string> = {
    service: 'text-brand-strong',
    shop: 'text-violet-ink',
}

/**
 * Один блок направления внутри карточки-гроссбуха (Pencil: `H7Mz74`'s пара
 * `fNwhK`+`Fbvla`+правила / `TMa9C`+`c56oXc`+правила, `b63e8p`'s мобильный аналог тех же узлов) —
 * заголовок (иконка · название · "· N правил" · бейдж начисления · факт/прогноз по направлению),
 * заголовок колонок таблицы правил, затем сами строки (`LedgerRuleRow`). Функционально — прямой
 * аналог старой `pages/SalaryReport/ui/DirectionSection.tsx` (то же вычисление "Месяц закрыт" для
 * `total.prognose === null`), не переиспользованной напрямую по той же причине, что и остальные
 * компоненты этой страницы (`pages` не может импортировать другую `pages`).
 *
 * Тело блока (заголовок колонок таблицы правил + сами строки) сворачивается по клику на заголовок
 * (`isExpanded`/`onToggle`, ключ — сам `report.direction`, собирается вызывающей стороной) — тот же
 * приём "целая строка — кнопка + хвостовой шеврон", что и у `LedgerRuleRow`; дефолт до первого клика
 * — "Сервис" свёрнут, "Магазин" развёрнут (см. `useSalaryReportSelection`'s комментарий про
 * инвертированный `Set`). Заголовок остаётся видимым всегда — сворачивается только всё, что ниже
 * него.
 */
export function LedgerDirectionBlock({
    report,
    isRuleExpanded,
    onToggleRule,
    isExpanded,
    onToggle,
    className,
}: LedgerDirectionBlockProps) {
    const Icon = DIRECTION_ICON[report.direction]

    return (
        <div data-slot="ledger-direction-block" className={cn('flex flex-col', className)}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isExpanded}
                className={cn(
                    'flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 text-left transition-colors md:px-5 md:py-3',
                    HEADER_CLASS[report.direction],
                )}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <Icon className={cn('size-4 shrink-0', ICON_CLASS[report.direction])} />
                    <span className="truncate font-ui text-base font-bold text-ink">{report.label}</span>
                    <span className="shrink-0 font-ui text-xs text-ink-muted">· {pluralizeRules(report.rules.length)}</span>
                    {report.accrualStatus !== null && <AccrualStatusBadge status={report.accrualStatus} />}
                </div>

                <div className="flex shrink-0 items-center gap-5">
                    <span className="font-ui text-base font-bold text-ink tabular-nums">{formatCurrency(report.total.fact)}</span>
                    <span
                        className={cn(
                            'font-ui text-base font-bold tabular-nums',
                            report.total.prognose === null ? 'text-warn-ink' : 'text-ink-muted',
                        )}
                    >
                        {report.total.prognose === null
                            ? report.isClosed
                                ? 'Месяц закрыт'
                                : '—'
                            : formatCurrency(report.total.prognose)}
                    </span>

                    <span className={LEDGER_CHEVRON_COL}>
                        <ChevronDown
                            className={cn(
                                'size-4 shrink-0 text-ink-muted transition-transform duration-150',
                                isExpanded && 'rotate-180',
                            )}
                        />
                    </span>
                </div>
            </button>

            {isExpanded &&
                (report.rules.length === 0 ? (
                    <p className="px-3 py-4 text-center font-ui text-xs text-ink-muted md:px-5">
                        В этом направлении нет зарплатных правил.
                    </p>
                ) : (
                    <>
                        <div className="hidden items-center gap-2 bg-canvas px-3 py-2.5 md:flex md:gap-3 md:px-5">
                            <span className="min-w-0 flex-1 font-ui text-xs font-semibold text-ink">Правило начисления</span>
                            <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-semibold text-ink')}>Факт, ₽</span>
                            <span className={cn(LEDGER_VALUE_COL, 'font-ui text-xs font-medium text-ink-muted')}>Прогноз, ₽</span>
                            <span className={LEDGER_CHEVRON_COL} />
                        </div>

                        {report.rules.map((rule) => {
                            const key = `${report.direction}:${rule.ruleId}`
                            return (
                                <LedgerRuleRow
                                    key={rule.ruleId}
                                    rule={rule}
                                    direction={report.direction}
                                    isClosed={report.isClosed}
                                    isExpanded={isRuleExpanded(key)}
                                    onToggle={() => onToggleRule(key)}
                                />
                            )
                        })}
                    </>
                ))}
        </div>
    )
}
