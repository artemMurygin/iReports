import { RadioCard } from '@/shared/ui-kit/atoms/RadioCard'

import type { TargetType } from '../../../model/types.ts'

export type TargetTypeFieldProps = {
    targetType: TargetType
    onTargetTypeChange: (targetType: TargetType) => void
}

/** "Цель начисления" (Pencil `tSYIw` → `Карточка · Схема`): Отдел или Сотрудник. Смена типа
 * сбрасывает выбранный id — это делает `model/useSchemaTarget.ts`. */
export function TargetTypeField({ targetType, onTargetTypeChange }: TargetTypeFieldProps) {
    return (
        <div className="flex flex-col gap-[7px]">
            <span className="font-ui text-xs font-medium text-ink-muted">Цель начисления</span>
            <div className="flex flex-col gap-2">
                <RadioCard
                    selected={targetType === 'Department'}
                    onSelect={() => onTargetTypeChange('Department')}
                    title="Отдел"
                    description="Правило действует на всех сотрудников отдела"
                />
                <RadioCard
                    selected={targetType === 'Employee'}
                    onSelect={() => onTargetTypeChange('Employee')}
                    title="Сотрудник"
                    description="Персональная схема для одного сотрудника"
                />
            </div>
        </div>
    )
}
