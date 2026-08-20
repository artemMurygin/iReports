import { useState } from 'react'
import type { CreateEmployeeIdentityRequest, EmployeeIdentityType, ExternalSystem } from 'ireports-contracts'

import { IDENTITY_TYPE_OPTIONS, identifierHint } from '@/pages/EmployeeIdentity/model/identityLabels.ts'
import type { IdentityFormTarget } from '@/pages/EmployeeIdentity/model/useEmployeeIdentityPage.ts'

type UseIdentityFormArgs = {
    target: IdentityFormTarget | null
    onSubmit: (payload: CreateEmployeeIdentityRequest) => void
}

/**
 * Стейт, валидация и сборка payload'а модалки связи (Pencil: design/sallary-first-iteration.pen,
 * фрейм `NjnJ3`). Вынесен из JSX по конвенции model/ui для компонента с собственной логикой
 * (frontend/CLAUDE.md, см. `features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts`).
 *
 * Поля пересеиваются, когда меняется `target` — то есть при каждом открытии модалки под новую
 * связь/сотрудника. Сравнение делается прямо в рендере («adjusting state»), а не в `useEffect`:
 * так первый же кадр открытой модалки показывает правильные значения, без промежуточного
 * рендера с чужими. Ключ сравнения — сам объект `target`: страница создаёт его заново на каждое
 * открытие, а пока модалка открыта, он неизменен, поэтому чужой рефетч не затрёт введённое.
 *
 * Форма всегда собирает полный `CreateEmployeeIdentityRequest`, включая сотрудника и систему,
 * даже в режиме правки, где они заблокированы: сузить payload до PATCH-тела — задача
 * вызывающего (`useEmployeeIdentityPage.handleSubmitForm`), который один знает про режим.
 */
export function useIdentityForm({ target, onSubmit }: UseIdentityFormArgs) {
    const [employeeId, setEmployeeId] = useState<number | null>(null)
    const [system, setSystem] = useState<ExternalSystem | null>(null)
    const [identifierType, setIdentifierType] = useState<EmployeeIdentityType | null>(null)
    const [externalId, setExternalId] = useState('')
    // Ошибки полей показываются только после первой попытки сохранить — иначе пустая форма
    // открывалась бы уже красной.
    const [isSubmitted, setIsSubmitted] = useState(false)

    const [seededTarget, setSeededTarget] = useState<IdentityFormTarget | null>(null)
    if (target !== seededTarget) {
        setSeededTarget(target)
        setIsSubmitted(false)
        if (target?.mode === 'edit') {
            setEmployeeId(target.identity.bitrixEmployeeId)
            setSystem(target.identity.system)
            setIdentifierType(target.identity.identifierType)
            setExternalId(target.identity.externalId)
        } else {
            setEmployeeId(target?.employeeId ?? null)
            setSystem(target?.system ?? null)
            setIdentifierType(null)
            setExternalId('')
        }
    }

    const isEditing = target?.mode === 'edit'
    const typeOptions = system ? IDENTITY_TYPE_OPTIONS[system] : []

    // Смена системы обнуляет тип, если он в новой системе не существует (поля закупщиков есть
    // только у МойСклада, «онлайн-менеджер» — только у RemOnline). `EMPLOYEE_ID` есть в обеих,
    // поэтому уже сделанный выбор при переключении не теряется.
    function handleSystemChange(next: ExternalSystem) {
        setSystem(next)
        if (identifierType && !IDENTITY_TYPE_OPTIONS[next].some((option) => option.value === identifierType)) {
            setIdentifierType(null)
        }
    }

    const errors = {
        employee: employeeId === null ? 'Выберите сотрудника' : null,
        system: system === null ? 'Выберите внешнюю систему' : null,
        identifierType: identifierType === null ? 'Выберите тип идентификатора' : null,
        // Контракт требует непустую строку (`z.string().min(1)`), поэтому пробелы не считаются
        // значением и обрезаются перед отправкой.
        externalId: externalId.trim() === '' ? 'Укажите идентификатор' : null,
    }
    const isValid = Object.values(errors).every((message) => message === null)
    const visibleErrors = isSubmitted
        ? errors
        : { employee: null, system: null, identifierType: null, externalId: null }

    function handleSubmit() {
        setIsSubmitted(true)
        if (!isValid || employeeId === null || system === null || identifierType === null) return

        onSubmit({ bitrixEmployeeId: employeeId, system, identifierType, externalId: externalId.trim() })
    }

    return {
        isEditing,
        employeeId,
        onEmployeeChange: (value: string) => setEmployeeId(Number(value)),
        system,
        onSystemChange: handleSystemChange,
        identifierType,
        onIdentifierTypeChange: setIdentifierType,
        externalId,
        onExternalIdChange: setExternalId,
        typeOptions,
        hint:
            system && identifierType
                ? identifierHint(system, identifierType)
                : 'Подсказка появится после выбора системы и типа идентификатора',
        errors: visibleErrors,
        handleSubmit,
    }
}
