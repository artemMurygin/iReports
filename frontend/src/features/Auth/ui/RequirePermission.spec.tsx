import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { useAuthStore } from '../model/authStore.ts'
import { RequirePermission } from './RequirePermission.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md — `RequirePermission`
 * (architecture.md: "Условный рендер по наличию permission, иначе
 * AccessDeniedScreen") читает `useHasPermission` (Zustand-стор), а не делает
 * собственный запрос — стор наполняется `useCurrentUser` в другом месте
 * дерева (обычно ближе к корню приложения).
 */
describe('RequirePermission', () => {
    beforeEach(() => {
        useAuthStore.setState({ employee: null, permissions: [], status: 'idle' })
    })

    it('рендерит children, когда у пользователя есть нужный permission', () => {
        useAuthStore.setState({ permissions: ['roles:manage'] })

        render(
            <RequirePermission permission="roles:manage">
                <div>Protected content</div>
            </RequirePermission>,
        )

        expect(screen.getByText('Protected content')).toBeInTheDocument()
    })

    it('рендерит AccessDeniedScreen вместо children, когда нужного permission нет', () => {
        useAuthStore.setState({ permissions: ['reports:view'] })

        render(
            <RequirePermission permission="roles:manage">
                <div>Protected content</div>
            </RequirePermission>,
        )

        expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
        expect(screen.getByRole('alert')).toBeInTheDocument()
    })
})
