import { useState, type KeyboardEvent } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { RoleResponse } from 'ireports-contracts'

import { Badge } from '@/shared/ui-kit/atoms/Badge'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Input } from '@/shared/ui-kit/atoms/Input'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.1); ui-design.md фрейм `s5nMLx`, узел
 * «Roles Bar» (карточки `wyDkI` "Role Card Администратор" / `S9MpM` "Role Card Руководитель").
 * Системная роль (`role.isSystem`, design.md Decision 9 — `Administrator`) показывает бейдж
 * «Системная» вместо иконок переименования/удаления, т.к. её нельзя удалить (spec:
 * roles#model-role-permission).
 *
 * ОТКЛОНЕНИЕ от макета (документировано, не решалось самостоятельно за пределами раздела 20 —
 * см. финальный отчёт): карточка в Pencil показывает счётчик «N сотрудников» под именем роли, но
 * ни `RoleResponse` (`GET /roles`), ни какой-либо другой эндпоинт `roles` не возвращает число
 * сотрудников с этой ролью (только `permissionCodes`) — тот же пробел в данных, что и у
 * `EmployeeRoleAssignment` (см. `useEmployeeRoleAssignment.ts`). Счётчик здесь не отображается,
 * а не заменяется на выдуманное значение.
 *
 * Переименование — инлайн-редактирование по клику на иконку (отдельной модалки для рено в
 * ui-design.md не описано, в отличие от создания роли, у которого есть `vKQ8C`): клик на
 * «Переименовать» переключает карточку в режим ввода, Enter/потеря фокуса с непустым
 * непустым значением вызывает `onRename`, Escape отменяет без вызова.
 */
export type RoleCardProps = {
    role: RoleResponse
    onRename: (id: string, name: string) => void
    onDelete: (id: string) => void
}

function RoleCard({ role, onRename, onDelete }: RoleCardProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [draftName, setDraftName] = useState(role.name)

    function startEditing() {
        setDraftName(role.name)
        setIsEditing(true)
    }

    function commit() {
        const trimmed = draftName.trim()
        setIsEditing(false)
        if (trimmed && trimmed !== role.name) {
            onRename(role.id, trimmed)
        }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter') {
            event.preventDefault()
            commit()
        } else if (event.key === 'Escape') {
            event.preventDefault()
            setIsEditing(false)
        }
    }

    return (
        <div
            data-slot="role-card"
            className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3.5 py-2.5"
        >
            {isEditing ? (
                <Input
                    autoFocus
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={commit}
                    onKeyDown={handleKeyDown}
                    className="h-8"
                />
            ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="truncate font-ui text-[13px] font-semibold text-ink">{role.name}</span>
                </div>
            )}

            {role.isSystem ? (
                <Badge tone="neutral">Системная</Badge>
            ) : (
                !isEditing && (
                    <div className="flex shrink-0 items-center gap-0.5">
                        <IconButton aria-label={`Переименовать роль ${role.name}`} onClick={startEditing}>
                            <Pencil />
                        </IconButton>
                        <IconButton
                            variant="danger"
                            aria-label={`Удалить роль ${role.name}`}
                            onClick={() => onDelete(role.id)}
                        >
                            <Trash2 />
                        </IconButton>
                    </div>
                )
            )}
        </div>
    )
}

export { RoleCard }
