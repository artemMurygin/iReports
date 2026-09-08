import { LEGEND_ORDER, STATUS_STYLE } from '../model/cellPresentation.ts'

export type LegendRowProps = {
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w` -> `Legend Row`. Свотчи строятся из
 * `STATUS_STYLE`/`LEGEND_ORDER` (`model/cellPresentation.ts`) — тот же источник цвета/подписи, что
 * и у самих ячеек таблицы, чтобы легенда не могла разойтись с реальной раскраской.
 */
function LegendRow({ className }: LegendRowProps) {
    return (
        <div data-slot="work-schedule-legend-row" className={className}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    {LEGEND_ORDER.map((status) => {
                        const style = STATUS_STYLE[status]
                        return (
                            <div key={status} className="flex items-center gap-1.5">
                                <div
                                    className={`flex size-[18px] items-center justify-center rounded-[5px] border border-hairline ${style.bgClassName}`}
                                >
                                    <span className={`font-ui text-[9px] font-semibold ${style.textClassName}`}>
                                        {style.legendGlyph}
                                    </span>
                                </div>
                                <span className="font-ui text-xs text-ink-muted">{style.label}</span>
                            </div>
                        )
                    })}
                </div>

                <span className="font-ui text-xs text-ink-faint">Цифра в ячейке — часы за смену</span>
            </div>
        </div>
    )
}

export { LegendRow }
