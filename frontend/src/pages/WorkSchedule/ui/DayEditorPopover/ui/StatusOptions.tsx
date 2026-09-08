import type { WorkScheduleStatus } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { STATUS_STYLE } from '@/pages/WorkSchedule/model/cellPresentation.ts'

export type StatusOptionsProps = {
    status: WorkScheduleStatus | null
    onSelect: (status: WorkScheduleStatus) => void
    disabled?: boolean
}

// Разбивка по рядам — «Options Row» × 2 в узле `Cko6w` → `Day Editor` → `Status Options`: три
// пилюли (Работает/Выходной/Отгул), затем ещё две (Больничный/Отпуск), а не один ряд с
// `flex-wrap` — так порядок переноса не зависит от точной ширины текста подписей.
const ROWS: WorkScheduleStatus[][] = [
    ['WORKING', 'DAY_OFF', 'TIME_OFF'],
    ['SICK_LEAVE', 'VACATION'],
]

// `STATUS_STYLE[status].textClassName` красит короткий глиф ячейки/легенды (`—`, 9-11px) — для
// DAY_OFF там сознательно самый бледный токен, `ink-faint` (см. cellPresentation.ts). Полное слово
// «Выходной» в пилюле поповера — уже не глиф, а обычная подпись, и в дизайне выкрашено обычным
// `ink-muted`, тем же токеном, что и подписи легенды (`LegendRow`'s `text-ink-muted`). Остальные
// четыре статуса совпадают с `textClassName` один в один, поэтому не дублируем всю карту ради
// одного расхождения — только точечный оверрайд.
function pillTextClassName(status: WorkScheduleStatus): string {
    return status === 'DAY_OFF' ? 'text-ink-muted' : STATUS_STYLE[status].textClassName
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w` → `Day Editor` → `Status Options` —
 * пять пилюль-переключателей статуса дня. Цвет/подпись каждой пилюли берутся из `STATUS_STYLE`
 * (`model/cellPresentation.ts`) — тот же источник, что и у самой ячейки таблицы и у легенды, так
 * что «Отгул»/«Больничный»/«Отпуск» одинаково подсвечены везде на странице; рамка выбранной пилюли
 * (2px, свой цвет на статус) — отдельное поле `selectedBorderClassName` того же объекта.
 */
function StatusOptions({ status, onSelect, disabled }: StatusOptionsProps) {
    return (
        <div data-slot="day-editor-status-options" className="flex w-full flex-col gap-1.5">
            {ROWS.map((row, index) => (
                <div key={index} className="flex w-fit flex-row gap-1.5">
                    {row.map((option) => {
                        const style = STATUS_STYLE[option]
                        const textClassName = pillTextClassName(option)
                        const selected = status === option

                        return (
                            <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                disabled={disabled}
                                onClick={() => onSelect(option)}
                                data-slot="day-editor-status-option"
                                data-status={option}
                                data-selected={selected || undefined}
                                className={cn(
                                    'flex shrink-0 items-center rounded-[7px] border px-2.5 py-[6px] font-ui text-xs transition-colors',
                                    style.bgClassName,
                                    selected
                                        ? cn('border-2 font-semibold', style.selectedBorderClassName, textClassName)
                                        : cn('border-hairline font-normal', textClassName),
                                    disabled && 'pointer-events-none opacity-50',
                                )}
                            >
                                {style.label}
                            </button>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

export { StatusOptions }
