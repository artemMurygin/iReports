import { Info } from 'lucide-react'
import type { FactPrognoseAmount } from 'ireports-contracts'

import { formatCurrency, formatPeriodLabel, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

import { getDeltaTone } from '../model/deltaTone.ts'

import { DeltaBadge } from './DeltaBadge.tsx'

export type LedgerHeroProps = {
    grandTotal: FactPrognoseAmount
    isClosed: boolean
    period: string
    className?: string
}

/**
 * Герой-строка карточки-гроссбуха (Pencil: `H7Mz74`'s `Y8Cgy` "Итого" — десктоп, `b63e8p`'s
 * `L3xuy` — мобайл): "Начислено всего · факт" (`grandTotal.fact`) слева, "Прогноз до конца
 * месяца" (`grandTotal.prognose`) + дельта справа — те же данные и та же деградация закрытого
 * месяца, что раньше показывала `pages/SalaryReport/ui/SalaryTotalsKpi.tsx`, только сведённые в
 * одну строку карточки вместо пары отдельных KPI-карточек.
 *
 * Инфо-попап поясняет расчёт прогноза обобщённо (те же правила "что входит"/"не входит", что
 * реально считает бэкенд — закрытые/оплаченные заказы, выполненные задачи по фикс-ставке, продажи
 * с проведённой оплатой; НЕ входят брони без оплаты, возвраты, ручные корректировки), а не
 * конкретную разбивку по суммам, как на сэмпле мокапа (`g7v849` "Как считается прогноз") — та
 * разбивка ("Сервис — ожидаемые заказы до 31.08: +30 000 ₽" и т.п.) не бэкенд-агрегат, а
 * иллюстративные цифры мокапа; подставлять их как реальные данные было бы фабрикацией.
 */
export function LedgerHero({ grandTotal, isClosed, period, className }: LedgerHeroProps) {
    const periodLabel = formatPeriodLabel(period)
    const prognoseValue = grandTotal.prognose ?? grandTotal.fact
    const delta = grandTotal.prognose !== null ? grandTotal.prognose - grandTotal.fact : 0

    return (
        <div
            data-slot="ledger-hero"
            className={cn('flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between md:gap-6 md:p-5', className)}
        >
            <div className="flex flex-col gap-1">
                <span className="font-ui text-[11px] font-semibold text-ink-muted">Начислено всего · факт</span>
                <span className="font-display text-[28px] font-bold tracking-[-0.4px] text-ink tabular-nums">
                    {formatCurrency(grandTotal.fact)}
                </span>
                <span className="font-ui text-xs text-ink-muted">Сервис + Магазин · {periodLabel}</span>
            </div>

            <div className="flex items-center justify-between gap-3 md:flex-col md:items-end md:gap-1">
                <div className="flex items-center gap-1.5">
                    <span className="font-ui text-[11px] font-semibold text-ink-muted">Прогноз до конца месяца</span>
                    <Popover>
                        <PopoverTrigger asChild>
                            <IconButton size="sm" aria-label="Как считается прогноз">
                                <Info />
                            </IconButton>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="flex flex-col gap-2.5">
                            <p className="font-ui text-[13px] font-semibold text-ink">Как считается прогноз</p>
                            <p className="font-ui text-xs text-ink-muted">
                                Факт на сегодня + ожидаемые начисления по правилам до конца месяца.
                            </p>
                            <div className="flex flex-col gap-1 font-ui text-xs text-ink">
                                <span className="font-semibold text-ink-muted">Учитывается:</span>
                                <span>Закрытые и оплаченные заказы, выполненные задачи, проведённые продажи</span>
                            </div>
                            <div className="flex flex-col gap-1 font-ui text-xs text-ink">
                                <span className="font-semibold text-ink-muted">Не учитывается:</span>
                                <span>Брони без оплаты, возвраты, ручные корректировки</span>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="flex flex-col items-end gap-1">
                    <span className="font-display text-lg font-bold tracking-[-0.3px] text-ink-muted tabular-nums md:text-xl">
                        {formatCurrency(prognoseValue)}
                    </span>
                    <DeltaBadge tone={getDeltaTone(delta, isClosed)}>
                        {isClosed ? 'Месяц закрыт' : `${formatSignedCurrency(delta)} к факту`}
                    </DeltaBadge>
                </div>
            </div>
        </div>
    )
}
