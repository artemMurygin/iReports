import type { WorkScheduleShiftRoleCount } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { resolveRoleStyle } from '../model/rolePresentation.ts'

export type RolesLegendProps = {
    roleCounts: WorkScheduleShiftRoleCount[]
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` -> `Roles Legend` — свотч + подпись +
 * счётчик на роль. Рендерит ровно то, что пришло в `roleCounts` ответа (бэкенд уже не отдаёт роли
 * с нулём человек в смене, ENDPOINTS.md) — блок целиком скрывается, если на смене никого нет.
 */
export function RolesLegend({ roleCounts, className }: RolesLegendProps) {
    if (roleCounts.length === 0) return null

    return (
        <section className={className}>
            <p className="mb-2 font-ui text-[12.5px] font-semibold text-ink">Роли на смене</p>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                {roleCounts.map(({ role, count }) => {
                    const style = resolveRoleStyle(role)
                    return (
                        <div key={role} className="flex shrink-0 items-center gap-1.5">
                            <span
                                className={cn(
                                    'flex size-[17px] items-center justify-center rounded-[5px] border border-hairline font-ui text-[9px] font-semibold',
                                    style.bgClassName,
                                    style.textClassName,
                                )}
                            >
                                {style.glyph}
                            </span>
                            <span className="font-ui text-[11.5px] text-ink-muted">{style.label}</span>
                            <span className="font-ui text-[11.5px] font-semibold text-ink">{count}</span>
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
