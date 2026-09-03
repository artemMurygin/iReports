import { FileText, Lock, Pencil, RotateCcw } from 'lucide-react'
import type { SalesDirection } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { PeriodPicker } from '@/features/SalesPlan'

const DIRECTIONS: { value: SalesDirection; label: string }[] = [
    { value: 'service', label: 'Сервис' },
    { value: 'shop', label: 'Магазин' },
]

export type PageHeaderProps = {
    direction: SalesDirection
    onDirectionChange: (direction: SalesDirection) => void
    period: string
    onPeriodChange: (period: string) => void
    onEditPlan: () => void
    editDisabled?: boolean
    /** Расчётный период выбранного месяца закрыт (`GET .../period/:period`). */
    isPeriodClosed: boolean
    /** «Иван Петров · 01.08.2026 14:20» — готовая подпись закрытия (null, пока грузится справочник). */
    closedLabel: string | null
    /** Месяц истёк (UTC) — только такой можно закрывать; иначе кнопка disabled с tooltip. */
    isPeriodExpired: boolean
    onCloseMonth: () => void
    onReopenMonth: () => void
    /** «Начисления за июль» — переход на список документов начисления закрытого месяца. */
    accrualsLabel: string
    onOpenAccruals: () => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, nodes `cNvpa` (`Page Header`) + `jvP4H`
 * (`Direction Row`), дополненные Фазой 4 docs/payroll-closing-and-accrual статусом
 * расчётного периода и действиями закрытия (`ePDd7` период открыт / `a1Mmrh` закрыт /
 * `lu0Bl` три состояния блока статуса, мобильный `GfwNx`):
 *
 * - Пилюля статуса справа от заголовка: «Период открыт» (brand-soft/ok-ink, как раньше,
 *   но теперь от реального `GET .../period/:period`) или «Период закрыт · Иван Петров ·
 *   01.08.2026 14:20» (info-soft/info-ink).
 * - Подзаголовок меняется вместе со статусом (тексты `ePDd7`/`a1Mmrh`).
 * - Строка направления: справа от Period Chip для открытого месяца — secondary
 *   «Изменить план» + primary «Закрыть месяц» (для неистёкшего месяца — disabled с
 *   tooltip «Месяц ещё не закончился», состояние C `lu0Bl`; свой hover-tooltip, потому
 *   что задизейбленная кнопка не получает событий из-за `pointer-events-none`); для
 *   закрытого — primary «Начисления за {месяц}» + secondary «Переоткрыть месяц»
 *   (`a1Mmrh`), «Изменить план» скрыт — план закрытого месяца зафиксирован снапшотом.
 *
 * Как и раньше, один общий компонент на оба брейкпоинта с `flex-wrap` вместо буквального
 * повторения отдельной мобильной строки кнопок из `GfwNx` — см. историю этого файла.
 */
function PageHeader({
    direction,
    onDirectionChange,
    period,
    onPeriodChange,
    onEditPlan,
    editDisabled,
    isPeriodClosed,
    closedLabel,
    isPeriodExpired,
    onCloseMonth,
    onReopenMonth,
    accrualsLabel,
    onOpenAccruals,
    className,
}: PageHeaderProps) {
    const subtitle = isPeriodClosed
        ? 'Месяц закрыт: отчет по зарплате сформирован, график работы закрыт для редактирования'
        : ''

    return (
        <div data-slot="sales-plan-page-header" className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-[26px] font-bold tracking-[-0.4px] text-ink">План продаж</h1>
                    <p className="font-ui text-sm text-ink-muted">{subtitle}</p>
                </div>

                {isPeriodClosed ? (
                    <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-info-soft px-3 py-[7px]">
                        <span className="size-[7px] rounded-full bg-info-ink" />
                        <span className="font-ui text-[13px] font-medium text-info-ink">
                            Период закрыт{closedLabel !== null ? ` · ${closedLabel}` : ''}
                        </span>
                    </div>
                ) : (
                    <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-[7px]">
                        <span className="size-[7px] rounded-full bg-brand-strong" />
                        <span className="font-ui text-[13px] font-medium text-ok-ink">Период открыт</span>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1 rounded-[10px] bg-hairline p-1" role="tablist" aria-label="Направление">
                    {DIRECTIONS.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={direction === value}
                            onClick={() => onDirectionChange(value)}
                            className={cn(
                                'rounded-lg px-3 py-1.5 font-ui text-[13px] transition-colors select-none',
                                direction === value
                                    ? 'bg-surface font-semibold text-ink shadow-sm'
                                    : 'font-medium text-ink-muted hover:text-ink',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <PeriodPicker period={period} onPeriodChange={onPeriodChange} isClosed={isPeriodClosed} />

                    {isPeriodClosed ? (
                        <>
                            <Button type="button" onClick={onOpenAccruals}>
                                <FileText />
                                {accrualsLabel}
                            </Button>
                            <Button type="button" variant="secondary" onClick={onReopenMonth}>
                                <RotateCcw />
                                Переоткрыть месяц
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button type="button" variant="secondary" onClick={onEditPlan} disabled={editDisabled}>
                                <Pencil />
                                Изменить план
                            </Button>
                            <span className="group relative inline-flex">
                                <Button type="button" onClick={onCloseMonth} disabled={!isPeriodExpired}>
                                    <Lock />
                                    Закрыть месяц
                                </Button>
                                {!isPeriodExpired && (
                                    <span
                                        role="tooltip"
                                        className="pointer-events-none absolute top-full right-0 z-10 mt-2 hidden rounded-lg bg-ink px-2.5 py-1.5 font-ui text-xs font-semibold whitespace-nowrap text-surface group-hover:block"
                                    >
                                        Месяц ещё не закончился
                                    </span>
                                )}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export { PageHeader }
