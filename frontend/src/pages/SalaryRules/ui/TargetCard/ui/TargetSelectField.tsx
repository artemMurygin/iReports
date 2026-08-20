import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'
import type { TargetOption } from '@/features/TargetDirectory'

import type { TargetType } from '../../../model/types.ts'

export type TargetSelectFieldProps = {
    targetType: TargetType
    targetId: number | null
    onTargetIdChange: (targetId: number) => void
    targetOptions: TargetOption[]
    isTargetOptionsLoading: boolean
    targetOptionsError?: string | null
}

/** Зависимый select Шага 1: какой справочник показан — отделов или сотрудников — решает
 * `targetType` (список приходит уже готовым из `model/useSalaryRulesPage.ts`). */
export function TargetSelectField({
    targetType,
    targetId,
    onTargetIdChange,
    targetOptions,
    isTargetOptionsLoading,
    targetOptionsError,
}: TargetSelectFieldProps) {
    const targetLabel = targetType === 'Department' ? 'отдел' : 'сотрудника'

    return (
        <div className="flex flex-col gap-1.5">
            <label className="font-ui text-xs font-medium text-ink-muted">
                {targetType === 'Department' ? 'Отдел' : 'Сотрудник'}
            </label>
            <Select
                value={targetId !== null ? String(targetId) : ''}
                onValueChange={(value) => onTargetIdChange(Number(value))}
                disabled={isTargetOptionsLoading || targetOptions.length === 0}
            >
                <SelectTrigger>
                    <SelectValue
                        placeholder={
                            isTargetOptionsLoading
                                ? 'Загрузка...'
                                : targetOptionsError
                                  ? 'Не удалось загрузить'
                                  : `Выберите ${targetLabel}`
                        }
                    />
                </SelectTrigger>
                <SelectContent>
                    {targetOptions.map((option) => (
                        <SelectItem key={option.id} value={String(option.id)}>
                            {option.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {targetOptionsError && <p className="font-ui text-xs text-danger">{targetOptionsError}</p>}
        </div>
    )
}
