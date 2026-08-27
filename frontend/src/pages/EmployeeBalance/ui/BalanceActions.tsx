import { Calendar, Download, Minus, Plus, X } from 'lucide-react'

import { PeriodPicker } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

import { currentMonthPeriod } from '../model/periodRange.ts'

export type BalanceActionsProps = {
    onAddIncome: () => void
    onAddOutcome: () => void
    /** Лента по умолчанию — «за всё время» (Фаза 8 docs/employee-settlements-page-redesign,
     * Pencil `L73YCK`/`JTc29` вовсе не показывают элемент периода — там лента сразу «за всё
     * время»). `null` — этот дефолт; `PeriodPicker` остаётся ДОПОЛНИТЕЛЬНЫМ сужением поверх
     * него, а не обязательным фильтром, как было до Фазы 8 — см. WHY в `onPeriodChange`. */
    period: string | null
    /** `null` — сбросить сужение обратно на «за всё время»; `YYYY-MM` — сузить/сдвинуть месяц. */
    onPeriodChange: (period: string | null) => void
    onExport: () => void
    /** Личный кабинет сотрудника (будущий readOnly-маршрут) скрывает «Добавить приход/расход» и
     * «Выплатить» — «Выгрузить ленту» остаётся доступной (просмотр собственной ленты). */
    readOnly?: boolean
    className?: string
}

/**
 * Панель действий (Pencil `L73YCK`/`JTc29`, docs/employee-settlements-page-redesign, Фаза 5) —
 * отдельная строка под шапкой баланса: «Добавить приход»/«Добавить расход» слева, «Выгрузить
 * ленту» (+ фильтр периода) справа. Раньше эти три кнопки жили внутри `BalanceHeader` — вынесены
 * в свой компонент, чтобы шапка осталась чистым «имя + баланс» блоком, как в макете.
 *
 * Отдельной кнопки «Выплатить» здесь больше нет (была раньше — открывала свой `PayoutDrawer` из
 * бывшей `features/Payout`): Фаза 6 docs/employee-settlements-page-redesign переносит создание
 * выплаты в «Добавить расход» (тип «Выплата» в `NewTransactionDrawer`, `features/EmployeeBalance`)
 * — макет `L73YCK`/`JTc29` и так не показывает отдельную кнопку.
 */
export function BalanceActions({
    onAddIncome,
    onAddOutcome,
    period,
    onPeriodChange,
    onExport,
    readOnly = false,
    className,
}: BalanceActionsProps) {
    return (
        <div
            data-slot="employee-balance-actions"
            className={cn('flex flex-wrap items-center justify-between gap-2', className)}
        >
            {!readOnly ? (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={onAddIncome}>
                        <Plus />
                        Добавить приход
                    </Button>
                    <Button type="button" variant="secondary" onClick={onAddOutcome}>
                        <Minus />
                        Добавить расход
                    </Button>
                </div>
            ) : (
                <span />
            )}

            <div className="flex shrink-0 items-center gap-2">
                {period === null ? (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onPeriodChange(currentMonthPeriod())}
                        title="Сузить ленту до одного месяца"
                    >
                        <Calendar />
                        За всё время
                    </Button>
                ) : (
                    <>
                        <PeriodPicker period={period} onPeriodChange={onPeriodChange} />
                        <IconButton
                            type="button"
                            aria-label="Сбросить период — показать за всё время"
                            title="Показать за всё время"
                            onClick={() => onPeriodChange(null)}
                        >
                            <X />
                        </IconButton>
                    </>
                )}
                <Button type="button" variant="secondary" onClick={onExport}>
                    <Download />
                    Выгрузить ленту
                </Button>
            </div>
        </div>
    )
}
