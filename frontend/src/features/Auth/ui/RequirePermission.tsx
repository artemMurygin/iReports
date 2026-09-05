import type { ReactNode } from 'react'

import { AccessDeniedScreen } from '@/shared/ui-kit/organisms/AccessDeniedScreen.tsx'

import { useHasPermission } from '../model/useHasPermission.ts'

type Props = {
    permission: string
    children: ReactNode
}

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md
 * `features/Auth/ui/RequirePermission`: "Условный рендер по наличию
 * permission, иначе AccessDeniedScreen". Дополняет `app/route-guard`
 * (раздел 15 — защита целых роутов): этот компонент — точечная защита
 * отдельных UI-элементов внутри уже открытой страницы.
 */
export function RequirePermission({ permission, children }: Props) {
    const hasPermission = useHasPermission(permission)

    if (!hasPermission) {
        return <AccessDeniedScreen />
    }

    return <>{children}</>
}
