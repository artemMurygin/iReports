import type { TargetRole } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { ROLE_LEGEND_ORDER, ROLE_STYLE } from '@/pages/WorkSchedule/model/rolePresentation.ts'

export type RoleOptionsProps = {
    role: TargetRole | null
    onSelect: (role: TargetRole) => void
}

/**
 * Пилюли выбора роли — вкладка «Роли» (узел `vO4tI`) не экспортирует свой собственный
 * поповер (см. чтение design-vO4tI-roles.html — в мокапе роль у каждого рабочего дня уже
 * проставлена, интерактива нет), поэтому вёрстка переиспользует паттерн `StatusOptions.tsx` (узел
 * `Cko6w` → `Day Editor` → `Status Options`, Фаза 7) один в один: та же пилюля-кнопка с 2px-рамкой
 * у выбранного варианта, тот же источник цвета/подписи, что и у самой ячейки и легенды (`ROLE_STYLE`,
 * `model/rolePresentation.ts`) — так роль одинаково выглядит и в таблице, и в легенде, и здесь.
 *
 * В одну колонку (`flex-col`), а не в ряды, как у `StatusOptions` — подписи ролей длиннее
 * («Онлайн-менеджер», «Офлайн-менеджер»), под фиксированную ширину поповера (296px,
 * `shared/ui-kit/atoms/Popover.tsx`) ряд из двух таких пилюль не помещается без переноса текста.
 */
function RoleOptions({ role, onSelect }: RoleOptionsProps) {
    return (
        <div data-slot="role-picker-options" role="radiogroup" className="flex w-full flex-col gap-1.5">
            {ROLE_LEGEND_ORDER.map((option) => {
                const style = ROLE_STYLE[option]
                const selected = role === option

                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onSelect(option)}
                        data-slot="role-picker-option"
                        data-role={option}
                        data-selected={selected || undefined}
                        className={cn(
                            'flex w-full items-center gap-2 rounded-[7px] border px-2.5 py-[6px] font-ui text-xs transition-colors',
                            style.bgClassName,
                            selected
                                ? cn('border-2 font-semibold', style.selectedBorderClassName, style.textClassName)
                                : cn('border-hairline font-normal', style.textClassName),
                        )}
                    >
                        <span
                            className={cn(
                                'flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-surface font-ui text-[9px] font-semibold',
                                style.textClassName,
                            )}
                        >
                            {style.glyph}
                        </span>
                        {style.label}
                    </button>
                )
            })}
        </div>
    )
}

export { RoleOptions }
