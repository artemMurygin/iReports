import { useState, type FormEvent } from 'react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.5-20.6); ui-design.md — модальное окно
 * создания роли (`ERP/Organism/Modal`, фрейм `vKQ8C` / узел `m12Tcd` "Dialog Создать роль"):
 * заголовок «Новая роль», подзаголовок «Название роли и права можно будет изменить позже», поле
 * «Название роли» с подсказкой-плейсхолдером «Например, «Оператор кассы»» и хелпер-текстом
 * «Видно только внутри iReports, сотрудники его не увидят», футер-хинт «Права настроите после
 * создания» и кнопка «Создать роль». Права ролям назначаются отдельно через
 * `RolePermissionMatrix` (spec: roles#model-role-permission — создание роли и назначение ей
 * permissions ИЗ каталога — независимые действия), поэтому эта модалка не принимает
 * `permissionCodes`.
 */
export type CreateRoleModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreate: (name: string) => void
    isCreating?: boolean
}

function CreateRoleModal({ open, onOpenChange, onCreate, isCreating }: CreateRoleModalProps) {
    const [name, setName] = useState('')

    function handleOpenChange(next: boolean) {
        if (!next) setName('')
        onOpenChange(next)
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) return
        onCreate(trimmed)
        setName('')
        onOpenChange(false)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title="Новая роль"
            subtitle="Название роли и права можно будет изменить позже"
            footer={
                <div className="flex items-center justify-between gap-3">
                    <p className="font-ui text-xs text-ink-muted">Права настроите после создания</p>
                    <Button type="submit" form="create-role-form" disabled={!name.trim() || isCreating}>
                        Создать роль
                    </Button>
                </div>
            }
        >
            <form id="create-role-form" className="flex flex-col gap-1.5" onSubmit={handleSubmit}>
                <label htmlFor="create-role-name" className="font-ui text-xs font-medium text-ink">
                    Название роли
                </label>
                <Input
                    id="create-role-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Например, «Оператор кассы»"
                    autoFocus
                />
                <p className="font-ui text-xs text-ink-muted">Видно только внутри iReports, сотрудники его не увидят</p>
            </form>
        </Modal>
    )
}

export { CreateRoleModal }
