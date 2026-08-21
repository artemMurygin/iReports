import { NOT_WORKING_ROLE_STYLE, ROLE_LEGEND_ORDER, ROLE_STYLE } from '../model/rolePresentation.ts'

export type RoleLegendRowProps = {
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `vO4tI` -> `Legend Row`. Своя легенда вкладки
 * «Роли» (план, Фаза 8: "своя легенда ролей") — те же четыре роли + «Не рабочий день», что и
 * `ROLE_STYLE`/`NOT_WORKING_ROLE_STYLE` (`model/rolePresentation.ts`), единый источник цвета/
 * подписи с самими ячейками таблицы (`RolesTable.tsx`), тем же приёмом, что и `LegendRow` для
 * вкладки «Календарь».
 */
function RoleLegendRow({ className }: RoleLegendRowProps) {
    return (
        <div data-slot="work-schedule-role-legend-row" className={className}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    {ROLE_LEGEND_ORDER.map((role) => {
                        const style = ROLE_STYLE[role]
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
                        <div
                            className={`flex size-[18px] items-center justify-center rounded-[5px] border border-hairline ${NOT_WORKING_ROLE_STYLE.bgClassName}`}
                        >
                            <span
                                className={`font-ui text-[9px] font-semibold ${NOT_WORKING_ROLE_STYLE.textClassName}`}
                            >
                                {NOT_WORKING_ROLE_STYLE.glyph}
                            </span>
                        </div>
                        <span className="font-ui text-xs text-ink-muted">{NOT_WORKING_ROLE_STYLE.label}</span>
                    </div>
                </div>

                <span className="font-ui text-xs text-ink-faint">Буква в ячейке — роль в этот день</span>
            </div>
        </div>
    )
}

export { RoleLegendRow }
