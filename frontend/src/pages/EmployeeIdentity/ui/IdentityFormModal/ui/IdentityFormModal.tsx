import type { CreateEmployeeIdentityRequest, EmployeeIdentityResponse } from 'ireports-contracts'

import { Modal } from '@/shared/ui-kit/organisms/Modal'
import type { EmployeeOption, IdentityFormTarget } from '@/pages/EmployeeIdentity/model/useEmployeeIdentityPage.ts'
import { useIdentityForm } from '@/pages/EmployeeIdentity/ui/IdentityFormModal/model/useIdentityForm.ts'
import { IdentityFormModalBody } from '@/pages/EmployeeIdentity/ui/IdentityFormModal/ui/IdentityFormModalBody.tsx'
import { IdentityFormModalFooter } from '@/pages/EmployeeIdentity/ui/IdentityFormModal/ui/IdentityFormModalFooter.tsx'

export type IdentityFormModalProps = {
    /** `null` — модалка закрыта. Что именно открыто (создание/правка) — см. `IdentityFormTarget`. */
    target: IdentityFormTarget | null
    employees: EmployeeOption[]
    isSaving: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (payload: CreateEmployeeIdentityRequest) => void
    onDelete: (identity: EmployeeIdentityResponse) => void
}

/**
 * Pencil: design/sallary-first-iteration.pen, фрейм `NjnJ3` («Новая связь») — заполненный
 * экземпляр базовой `ERP/Organism/Modal` (`shared/ui-kit/organisms/Modal`) шириной ~720px:
 * форма связи «сотрудник × внешняя система × тип идентификатора × значение». Тот же компонент
 * работает и на правку («Изменение связи»), где сотрудник и система заблокированы — отличается
 * только заголовок и заблокированные поля, дублировать всю форму ради этого нечего.
 *
 * Открытость выведена из `target !== null`, а не из отдельного флага: страница владеет ровно
 * одним состоянием на модалку и не может рассинхронизировать «открыто» и «что открыто».
 * Состояние полей и валидация — в `useIdentityForm`; здесь только сборка слотов `Modal`.
 */
function IdentityFormModal({ target, employees, isSaving, onOpenChange, onSubmit, onDelete }: IdentityFormModalProps) {
    const form = useIdentityForm({ target, onSubmit })
    const selectedEmployee = employees.find((employee) => employee.id === form.employeeId)

    const body = (
        <IdentityFormModalBody
            isEditing={form.isEditing}
            employees={employees}
            employeeId={form.employeeId}
            onEmployeeChange={form.onEmployeeChange}
            system={form.system}
            onSystemChange={form.onSystemChange}
            identifierType={form.identifierType}
            onIdentifierTypeChange={form.onIdentifierTypeChange}
            typeOptions={form.typeOptions}
            externalId={form.externalId}
            onExternalIdChange={form.onExternalIdChange}
            hint={form.hint}
            errors={form.errors}
        />
    )

    const footer = (
        <IdentityFormModalFooter
            isEditing={form.isEditing}
            isSaving={isSaving}
            onCancel={() => onOpenChange(false)}
            onSave={form.handleSubmit}
            onDelete={() => {
                if (target?.mode === 'edit') onDelete(target.identity)
            }}
        />
    )

    return (
        <Modal
            open={target !== null}
            onOpenChange={onOpenChange}
            className="sm:max-w-[720px]"
            title={form.isEditing ? 'Изменение связи' : 'Новая связь'}
            subtitle={
                selectedEmployee
                    ? `${selectedEmployee.name} · ${selectedEmployee.departmentName}`
                    : 'Выберите сотрудника и систему, в которой его нужно опознавать'
            }
            footer={footer}
        >
            {body}
        </Modal>
    )
}

export { IdentityFormModal }
