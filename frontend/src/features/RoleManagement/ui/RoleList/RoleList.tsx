import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { RoleResponse } from 'ireports-contracts'

import { Button } from '@/shared/ui-kit/atoms/Button'

import { CreateRoleModal } from './CreateRoleModal.tsx'
import { RoleCard } from './RoleCard.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.1, 20.5-20.6); architecture.md
 * `features/RoleManagement/ui/RoleList`: "карточки ролей с CRUD, бейдж «Системная» для
 * `Administrator` без удаления"; ui-design.md фрейм `s5nMLx`, узел «Roles Bar» (`p95Yo`) + модалка
 * создания роли `vKQ8C`. Чисто визуальная вёрстка — единственное ветвление (`role.isSystem`)
 * вынесено в `RoleCard`, покрыто тестами `useRoles` из раздела 19 (обоснование в tasks.md 20.1).
 *
 * Пустое состояние (ни одной роли) — НЕ обрабатывается здесь: по ui-design.md (`uRNsj`) оно
 * заменяет собой весь блок «Список ролей + Матрица прав» целиком, а не только список ролей,
 * поэтому переключение живёт на уровень выше (`pages/RolesManagement`, раздел 20.3-20.4) — этот
 * компонент при пустом `roles` просто не рендерит ни одной карточки.
 */
export type RoleListProps = {
    roles: RoleResponse[]
    onCreate: (name: string) => void
    onRename: (id: string, name: string) => void
    onDelete: (id: string) => void
    isCreating?: boolean
}

function RoleList({ roles, onCreate, onRename, onDelete, isCreating }: RoleListProps) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

    return (
        <div data-slot="role-list" className="flex flex-wrap items-center gap-2.5">
            {roles.map((role) => (
                <RoleCard key={role.id} role={role} onRename={onRename} onDelete={onDelete} />
            ))}

            <Button variant="secondary" onClick={() => setIsCreateModalOpen(true)}>
                <Plus />
                Добавить роль
            </Button>

            <CreateRoleModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onCreate={onCreate}
                isCreating={isCreating}
            />
        </div>
    )
}

export { RoleList }
