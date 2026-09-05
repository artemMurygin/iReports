import type { ReactNode } from 'react'
import { useMatches } from 'react-router-dom'

import { LoginPage } from '@/pages/Login'
import { AccessDeniedPage } from '@/pages/AccessDenied'

import type { RouteHandle } from '../model/useRouteGuardState.ts'
import { useRouteGuardState } from '../model/useRouteGuardState.ts'

type Props = {
    children: ReactNode
}

// Первая реализация route-guard в проекте (add-bitrix24-auth-and-rbac,
// раздел 15 tasks.md) — оборачивает `element: <Layout />` в
// `app/router.tsx`. Два независимых правила:
//
// 1. standalone/iOS-контекст без валидной сессии -> `pages/Login`
//    (architecture.md: `pages/Login` "не рендерится в embedded-контексте" —
//    в iframe вместо этого ожидается скрытый embedded-логин, который эта
//    задача не реализует, см. финальный отчёт по разделу 15).
// 2. защищённый роут (объявляет `handle.requiredPermission`, читается через
//    `useMatches()`) без нужного permission у текущего пользователя ->
//    `pages/AccessDenied` — независимо от контекста запуска. Ни один роут
//    пока не объявляет `requiredPermission` (появится в разделе 20 tasks.md
//    у `/admin/roles`), поэтому это правило сегодня не срабатывает ни на
//    одном реальном роуте — только на роутах будущих задач.
export function RouteGuard({ children }: Props) {
    const matches = useMatches()
    const requiredPermission = (matches.at(-1)?.handle as RouteHandle | undefined)?.requiredPermission

    const { context, isLoading, hasSession, hasRequiredPermission } = useRouteGuardState(requiredPermission)

    if (isLoading) {
        return null
    }

    if (context === 'standalone' && !hasSession) {
        return <LoginPage />
    }

    if (requiredPermission !== undefined && !hasRequiredPermission) {
        return <AccessDeniedPage />
    }

    return <>{children}</>
}
