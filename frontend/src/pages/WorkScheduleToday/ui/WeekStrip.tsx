import { cn } from '@/shared/lib/tw'

export type WeekStripDay = {
    date: string
    day: number
    weekdayShort: string
    isWeekend: boolean
    isSelected: boolean
    /** `null`, пока состав смены этого дня ещё не загружен (см. `useWorkScheduleTodayPage` —
     * все 7 дней запрашиваются параллельно и подгружаются не строго одновременно). */
    peopleOnShift: number | null
}

export type WeekStripProps = {
    days: WeekStripDay[]
    onSelect: (date: string) => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` -> `Week Strip` — 7 карточек-кнопок
 * дня недели. Выбранный день — `brand-soft` заливка / `brand-strong` рамка 1.5px / бейдж числа в
 * `brand-strong`; будни без выбора — `surface`, выходные без выбора — `canvas` (в дизайне у
 * выходных бейдж сливается с фоном карточки — тот же `canvas`/`#F8F8F8` у обоих, воспроизведено
 * как есть).
 */
export function WeekStrip({ days, onSelect, className }: WeekStripProps) {
    return (
        <div className={cn('flex w-full items-stretch gap-1.5', className)} role="tablist" aria-label="Дни недели">
            {days.map((day) => (
                <button
                    key={day.date}
                    type="button"
                    role="tab"
                    aria-selected={day.isSelected}
                    onClick={() => onSelect(day.date)}
                    className={cn(
                        'flex h-[62px] flex-1 flex-col items-center justify-center gap-[3px] rounded-[10px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40',
                        day.isSelected
                            ? 'border-[1.5px] border-brand-strong bg-brand-soft'
                            : cn('border border-hairline', day.isWeekend ? 'bg-canvas' : 'bg-surface'),
                    )}
                >
                    <span
                        className={cn(
                            'font-ui text-[10.5px]',
                            day.isSelected ? 'font-semibold text-ok-ink' : 'font-normal text-ink-muted',
                        )}
                    >
                        {day.weekdayShort}
                    </span>
                    <span
                        className={cn('font-ui text-[15px] text-ink', day.isSelected ? 'font-bold' : 'font-semibold')}
                    >
                        {day.day}
                    </span>
                    <span
                        className={cn(
                            'rounded-[5px] px-[5px] py-px font-ui text-[10px] font-semibold',
                            day.isSelected ? 'bg-brand-strong text-brand-foreground' : 'bg-canvas text-ink-muted',
                        )}
                    >
                        {day.peopleOnShift ?? '–'}
                    </span>
                </button>
            ))}
        </div>
    )
}
