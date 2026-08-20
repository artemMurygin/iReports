import type { TargetRole } from 'ireports-contracts'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import { ROLE_LABELS } from '../../../model/roleLabels.ts'

import { FieldError } from './FieldError.tsx'

export type RuleRoleFieldProps = {
    value: TargetRole | ''
    /** Роли, разрешённые текущему типу правила (`allowedRolesByType[draft.type]`). */
    allowedRoles: TargetRole[]
    isLoading: boolean
    /** Ошибка загрузки справочника ролей — влияет только на плейсхолдер. */
    loadError?: string | null
    /** Ошибка валидации поля из резолвера направления. */
    error?: string
    onValueChange: (role: TargetRole) => void
}

/** Поле «Роль» в сетке основных полей карточки: список ролей, допустимых текущему типу правила. */
export function RuleRoleField({ value, allowedRoles, isLoading, loadError, error, onValueChange }: RuleRoleFieldProps) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="font-ui text-xs font-medium text-ink-muted">Роль</label>
            <Select
                value={value}
                onValueChange={(next) => onValueChange(next as TargetRole)}
                disabled={isLoading || allowedRoles.length === 0}
            >
                <SelectTrigger>
                    <SelectValue
                        placeholder={isLoading ? 'Загрузка...' : loadError ? 'Не удалось загрузить' : 'Выберите роль'}
                    />
                </SelectTrigger>
                <SelectContent>
                    {allowedRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <FieldError message={error} />
        </div>
    )
}
