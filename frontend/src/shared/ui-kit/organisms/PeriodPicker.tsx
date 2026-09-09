import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/shared/lib/tw.ts'
import { formatPeriodLabel, isValidPeriod, shiftPeriod } from '@/shared/lib/format.ts'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

export type PeriodPickerProps = {
    period: string
    onChange: (period: string) => void
    /** Верхняя граница выбора (обычно текущий месяц) — следующая стрелка дизейблится за ним. Без
     * `maxPeriod` месяц можно листать в обе стороны без ограничения. */
    maxPeriod?: string
    className?: string
}

/**
 * Выбор месяца отчёта (openspec/changes/service-turnover-report, задача 19; architecture.md —
 * `PeriodPicker (new, shared/ui-kit/, если ещё нет подходящего)`, `organisms`, props `period`/
 * `onChange`/`maxPeriod`). Подходящего компонента в `shared/ui-kit/organisms` не нашлось —
 * `features/SalesPlan/ui/PeriodPicker.tsx` похож визуально, но это внутренний компонент фичи
 * `SalesPlan` (кросс-импорт `features -> features` запрещён линтингом, `frontend/CLAUDE.md`), и
 * его формат чуть другой («Период: <месяц>» в одном чипе на все брейкпоинты) — здесь новый
 * organism уровня `shared/ui-kit`, как и предписывает architecture.md.
 *
 * Pencil (`Get`+`resolveVariables`, узел `wrXyr` в `WvSO6`/десктоп): подпись «Период ·» + значение
 * + `chevron-down` 15px, тот же визуальный паттерн, что `WarehouseSelect`
 * (`pages/GoodsTurnoverReport/ui/WarehouseSelect.tsx`, задача 16) — тоже переиспользует его же
 * `border-hairline` вместо буквального `#A9AFAA` из макета (тот же задокументированный трейд-офф
 * "переиспользование существующего примитива/токена важнее пиксель-в-пиксель", что уже принят
 * WarehouseSelect в задаче 16). Мобильный вариант (узлы `uDo7o`/`oSPQU` в `yDBTb`/`RvLO7`) —
 * другая композиция: без подписи «Период ·», вместо неё иконка `calendar` 14px перед значением
 * (`fill_container` по ширине строки `Row A`, растягивается рядом с `PeriodStatusBadge`) — как и у
 * `WarehouseSelect`, два независимых `Popover`-инстанса с общим `value`/`onChange`, а не одно и то
 * же дерево, сжатое по ширине.
 *
 * Открывающийся поповер (стрелки назад/вперёд вокруг текущего месяца) не имеет отдельного узла в
 * макете — тот же случай, что и `features/SalesPlan/ui/PeriodPicker.tsx`: макет специфицирует
 * только закрытый триггер, разметку выпадающего содержимого пришлось спроектировать самостоятельно
 * из уже существующих атомов UI Kit (`IconButton`, новый `shared/ui-kit/atoms/Popover.tsx`).
 */
export function PeriodPicker({ period, onChange, maxPeriod, className }: PeriodPickerProps) {
    const label = formatPeriodLabel(period)
    const isAtMax = maxPeriod !== undefined && period >= maxPeriod

    function apply(candidate: string) {
        if (!isValidPeriod(candidate)) return
        if (maxPeriod !== undefined && candidate > maxPeriod) return
        onChange(candidate)
    }

    const popoverContent = (
        <PopoverContent align="end" className="w-56 gap-3 p-3">
            <div className="flex items-center justify-between gap-2">
                <IconButton type="button" onClick={() => apply(shiftPeriod(period, -1))} aria-label="Предыдущий месяц">
                    <ChevronLeft />
                </IconButton>
                <span className="font-ui text-[13px] font-semibold text-ink tabular-nums">{label}</span>
                <IconButton
                    type="button"
                    onClick={() => apply(shiftPeriod(period, 1))}
                    aria-label="Следующий месяц"
                    disabled={isAtMax}
                >
                    <ChevronRight />
                </IconButton>
            </div>
        </PopoverContent>
    )

    return (
        <>
            <div data-slot="period-picker-desktop" className={cn('hidden md:flex', className)}>
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="flex w-[220px] items-center justify-between gap-2 rounded-[10px] border border-hairline bg-surface px-3 py-[9px] transition-colors hover:bg-canvas"
                        >
                            <span className="flex items-center gap-1">
                                <span className="font-ui text-[13px] font-normal text-ink-muted">Период ·</span>
                                <span className="font-ui text-[13px] font-semibold text-ink">{label}</span>
                            </span>
                            <ChevronDown className="size-[15px] shrink-0 text-ink-muted" />
                        </button>
                    </PopoverTrigger>
                    {popoverContent}
                </Popover>
            </div>

            <div data-slot="period-picker-mobile" className={cn('flex flex-1 md:hidden', className)}>
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded-[9px] border border-hairline bg-surface px-2.5 py-[9px] transition-colors hover:bg-canvas"
                        >
                            <span className="flex items-center gap-1.5">
                                <Calendar className="size-[14px] shrink-0 text-ink-muted" />
                                <span className="font-ui text-[13px] font-semibold text-ink">{label}</span>
                            </span>
                            <ChevronDown className="size-[15px] shrink-0 text-ink-muted" />
                        </button>
                    </PopoverTrigger>
                    {popoverContent}
                </Popover>
            </div>
        </>
    )
}
