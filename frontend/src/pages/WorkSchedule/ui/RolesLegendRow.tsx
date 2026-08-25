import { ROLE_LEGEND_ORDER, roleStyle } from '../model/rolePresentation.ts'

export type RolesLegendRowProps = {
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `vO4tI` -> `Legend Row`. Своя легенда вкладки
 * «Роли» (аналог `LegendRow.tsx` для `Cko6w`) — четыре роли из `ROLE_LEGEND_ORDER` плюс пятый,
 * статичный свотч «Не рабочий день» (не берётся из `rolePresentation.ts`, потому что это не роль, а
 * состояние ячейки — тот же класс, что и `NOT_WORKING_STYLE` внутри модуля, продублирован здесь как
 * литерал по той же причине, по которой `EMPTY` в `cellPresentation.ts` не заводит отдельную запись
 * в `STATUS_STYLE`).
 */
function RolesLegendRow({ className }: RolesLegendRowProps) {
    return (
        <div data-slot="work-schedule-roles-legend-row" className={className}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    {ROLE_LEGEND_ORDER.map((role) => {
                        const style = roleStyle(role)
                        return (
                            <div key={role} className="flex items-center gap-1.5">
                                <div
                                    className={`flex size-[18px] items-center justify-center rounded-[5px] border border-hairline ${style.bgClassName}`}
                                >
                                    <span className={`font-ui text-[9px] font-semibold ${style.textClassName}`}>
                                        {style.glyph}
                                    </span>
                                </div>
                                <span className="font-ui text-xs text-ink-muted">{style.label}</span>
                            </div>
                        )
                    })}

                    <div className="flex items-center gap-1.5">
                        <div className="flex size-[18px] items-center justify-center rounded-[5px] border border-hairline bg-canvas">
                            <span className="font-ui text-[9px] font-semibold text-ink-faint">—</span>
                        </div>
                        <span className="font-ui text-xs text-ink-muted">Не рабочий день</span>
                    </div>
                </div>

                <span className="font-ui text-xs text-ink-faint">Буква в ячейке — роль в этот день</span>
            </div>
        </div>
    )
}

export { RolesLegendRow }
