import { useState } from 'react'
import { Plus, Shield } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { CreateRoleModal } from '@/features/RoleManagement'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.3-20.4); ui-design.md — отдельный артборд
 * `uRNsj` ("RolesManagement — Роли и права — Пусто"): 68px `canvas`-круг с иконкой `shield`
 * (`ink-muted`), заголовок «Пока нет ни одной роли», описание и CTA «Создать роль» —
 * заменяет собой список ролей и матрицу прав целиком (`RolesAndPermissionsTab`), не только
 * список ролей.
 *
 * CTA открывает ту же модалку создания роли, что и `RoleList` (`ui/RoleList/CreateRoleModal.tsx`)
 * — с собственным локальным состоянием открытия, поскольку `RoleList` здесь не рендерится.
 */
export type EmptyRolesStateProps = {
    onCreate: (name: string) => void
    isCreating?: boolean
}

function EmptyRolesState({ onCreate, isCreating }: EmptyRolesStateProps) {
    const [isModalOpen, setIsModalOpen] = useState(false)

    return (
        <div
            data-slot="empty-roles-state"
            className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-hairline bg-surface px-6 py-16 text-center"
        >
            <div className="flex size-[68px] items-center justify-center rounded-full border border-hairline bg-canvas">
                <Shield className="size-[26px] text-ink-muted" />
            </div>

            <div className="flex flex-col items-center gap-2">
                <h2 className="font-display text-lg font-bold tracking-[-0.2px] text-ink">Пока нет ни одной роли</h2>
                <p className="max-w-[420px] font-ui text-[13px] leading-[1.5] text-ink-muted">
                    Создайте первую роль и настройте, какие разделы iReports будут доступны сотрудникам с этой ролью
                </p>
            </div>

            <Button onClick={() => setIsModalOpen(true)}>
                <Plus />
                Создать роль
            </Button>

            <CreateRoleModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                onCreate={onCreate}
                isCreating={isCreating}
            />
        </div>
    )
}

export { EmptyRolesState }
