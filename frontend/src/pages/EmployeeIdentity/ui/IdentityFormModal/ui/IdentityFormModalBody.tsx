import type { ReactNode } from 'react'
import type { EmployeeIdentityType, ExternalSystem } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { RadioCard } from '@/shared/ui-kit/atoms/RadioCard'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'
import {
    SYSTEMS,
    SYSTEM_DESCRIPTION,
    SYSTEM_LABEL,
    type IdentityTypeOption,
} from '@/pages/EmployeeIdentity/model/identityLabels.ts'
import type { EmployeeOption } from '@/pages/EmployeeIdentity/model/useEmployeeIdentityPage.ts'

type Props = {
    isEditing: boolean
    employees: EmployeeOption[]
    employeeId: number | null
    onEmployeeChange: (value: string) => void
    system: ExternalSystem | null
    onSystemChange: (system: ExternalSystem) => void
    identifierType: EmployeeIdentityType | null
    onIdentifierTypeChange: (identifierType: EmployeeIdentityType) => void
    typeOptions: IdentityTypeOption[]
    externalId: string
    onExternalIdChange: (value: string) => void
    hint: string
    errors: {
        employee: string | null
        system: string | null
        identifierType: string | null
        externalId: string | null
    }
}

/** Одно поле формы: подпись 12/600, контрол и под ним подсказка либо ошибка. */
function Field({
    label,
    error,
    hint,
    children,
}: {
    label: string
    error?: string | null
    hint?: string
    children: ReactNode
}) {
    return (
        <div className="flex flex-col gap-2">
            <span className="font-ui text-xs font-semibold text-ink">{label}</span>
            {children}
            {error ? (
                <span className="font-ui text-xs text-danger">{error}</span>
            ) : (
                hint && <span className="font-ui text-xs text-ink-muted">{hint}</span>
            )}
        </div>
    )
}

/**
 * Pencil: design/sallary-first-iteration.pen, фрейм `NjnJ3` («Новая связь») — тело модалки:
 * селект сотрудника, две карточки-радио внешней системы, карточки-радио типа идентификатора
 * (набор зависит от выбранной системы) и поле значения с подсказкой.
 *
 * В режиме правки сотрудник и система заблокированы: PATCH принимает только `identifierType`
 * и `externalId` (см. `UpdateEmployeeIdentityRequest`), а перевесить связь на другого
 * сотрудника — это уже другая связь, а не правка этой. Селект блокируется своим `disabled`,
 * карточки-радио своего `disabled` не имеют, поэтому группа гасится
 * `pointer-events-none` + `aria-disabled` на контейнере.
 */
function IdentityFormModalBody({
    isEditing,
    employees,
    employeeId,
    onEmployeeChange,
    system,
    onSystemChange,
    identifierType,
    onIdentifierTypeChange,
    typeOptions,
    externalId,
    onExternalIdChange,
    hint,
    errors,
}: Props) {
    return (
        <div className="flex flex-col gap-4">
            <Field label="Сотрудник" error={errors.employee}>
                {/* Пустая строка, а не `undefined`: Radix Select одинаково показывает на них
                    плейсхолдер, но `undefined` переводит контрол в неуправляемый режим и
                    выбивает предупреждение React при первом же выборе сотрудника. */}
                <Select
                    value={employeeId === null ? '' : String(employeeId)}
                    onValueChange={onEmployeeChange}
                    disabled={isEditing}
                >
                    <SelectTrigger aria-label="Сотрудник">
                        <SelectValue placeholder="Выберите сотрудника" />
                    </SelectTrigger>
                    <SelectContent>
                        {employees.map((employee) => (
                            <SelectItem key={employee.id} value={String(employee.id)}>
                                {employee.name} · {employee.departmentName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>

            <Field label="Внешняя система" error={errors.system}>
                <div
                    role="radiogroup"
                    aria-label="Внешняя система"
                    aria-disabled={isEditing}
                    className={cn('grid gap-2.5 sm:grid-cols-2', isEditing && 'pointer-events-none opacity-60')}
                >
                    {SYSTEMS.map((value) => (
                        <RadioCard
                            key={value}
                            selected={system === value}
                            title={SYSTEM_LABEL[value]}
                            description={SYSTEM_DESCRIPTION[value]}
                            onSelect={isEditing ? undefined : () => onSystemChange(value)}
                        />
                    ))}
                </div>
            </Field>

            <Field
                label="Тип идентификатора"
                error={errors.identifierType}
                hint={system ? undefined : 'Сначала выберите внешнюю систему'}
            >
                <div role="radiogroup" aria-label="Тип идентификатора" className="grid gap-2">
                    {typeOptions.map((option) => (
                        <RadioCard
                            key={option.value}
                            selected={identifierType === option.value}
                            title={option.title}
                            description={option.description}
                            onSelect={() => onIdentifierTypeChange(option.value)}
                        />
                    ))}
                </div>
            </Field>

            <Field label="Идентификатор" error={errors.externalId} hint={hint}>
                <Input
                    value={externalId}
                    onChange={(event) => onExternalIdChange(event.target.value)}
                    placeholder="Например, 412"
                    aria-label="Идентификатор"
                />
            </Field>
        </div>
    )
}

export { IdentityFormModalBody }
