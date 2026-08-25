import type { TargetRole } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { ASSIGNABLE_ROLES, roleStyle } from '@/pages/WorkSchedule/model/rolePresentation.ts'

export type RoleOptionsProps = {
    role: TargetRole | null
    onSelect: (role: TargetRole) => void
}

/**
 * Четыре пилюли выбора роли рабочего дня — тот же визуальный паттерн, что и `StatusOptions.tsx`
 * (`DayEditorPopover`, Фаза 7), на стилях `roleStyle`/`ASSIGNABLE_ROLES` (`model/rolePresentation.ts`)
 * вместо `STATUS_STYLE`. Один ряд с переносом (`flex-wrap`), а не два фиксированных ряда, как у
 * статусов — здесь всего четыре варианта одинаковой длины подписи против пяти разной длины.
 */
function RoleOptions({ role, onSelect }: RoleOptionsProps) {
    return (
        <div data-slot="role-editor-options" className="flex w-full flex-row flex-wrap gap-1.5">
            {ASSIGNABLE_ROLES.map((option) => {
                const style = roleStyle(option)
                const selected = role === option

                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onSelect(option)}
                        data-slot="role-editor-option"
                        data-role={option}
                        data-selected={selected || undefined}
                        className={cn(
                            'flex shrink-0 items-center gap-1.5 rounded-[7px] border px-2.5 py-[6px] font-ui text-xs transition-colors',
                            style.bgClassName,
                            selected
                                ? cn('border-2 font-semibold', style.selectedBorderClassName, style.textClassName)
                                : cn('border-hairline font-normal', style.textClassName),
                        )}
                    >
                        <span className="font-semibold">{style.glyph}</span>
                        {style.label}
                    </button>
                )
            })}
        </div>
    )
}

export { RoleOptions }
