import { CalendarCheck } from 'lucide-react'

export type PageHeaderProps = {
    todayLabel: string
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w` -> `Page Header`. Title Block (26/700
 * Montserrat + 13px `ink-muted` подзаголовок) слева, «Today Chip» (`canvas`-заливка, `hairline`
 * рамка, calendar-check иконка `ok-ink`, «Сегодня · {дата}») справа — воспроизведено 1:1 по
 * тексту дизайна.
 */
function PageHeader({ todayLabel, className }: PageHeaderProps) {
    return (
        <div data-slot="work-schedule-page-header" className={className}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-[26px] font-bold tracking-[-0.4px] text-ink">График работы</h1>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-3 py-[7px]">
                    <CalendarCheck className="size-[14px] text-ok-ink" />
                    <span className="font-ui text-[13px] font-medium text-ink">Сегодня · {todayLabel}</span>
                </div>
            </div>
        </div>
    )
}

export { PageHeader }
