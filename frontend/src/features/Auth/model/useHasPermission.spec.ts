import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useAuthStore } from './authStore.ts'
import { useHasPermission } from './useHasPermission.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md — `useHasPermission` не делает
 * запросов сам, а читает уже загруженные `useCurrentUser`'ом permissions из
 * общего Zustand-стора (`authStore.ts`, первое использование zustand в проекте,
 * см. architecture.md `useHasPermission`: "state-хук (читает Zustand-стор)").
 */
describe('useHasPermission', () => {
    beforeEach(() => {
        useAuthStore.setState({ employee: null, permissions: [], status: 'idle' })
    })

    it('возвращает false, когда стор пуст (сессия ещё не загружена/не подтверждена)', () => {
        const { result } = renderHook(() => useHasPermission('roles:manage'))

        expect(result.current).toBe(false)
    })

    it('возвращает true, когда permission есть в сторе', () => {
        act(() => {
            useAuthStore
                .getState()
                .setAuthenticated({ employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' }, permissions: ['roles:manage'] })
        })

        const { result } = renderHook(() => useHasPermission('roles:manage'))

        expect(result.current).toBe(true)
    })

    it('возвращает false для permission, которого нет среди прав пользователя', () => {
        act(() => {
            useAuthStore
                .getState()
                .setAuthenticated({ employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' }, permissions: ['reports:view'] })
        })

        const { result } = renderHook(() => useHasPermission('roles:manage'))

        expect(result.current).toBe(false)
    })

    it('реагирует на изменение стора после того, как хук уже отрендерен (push прав в активную сессию)', () => {
        const { result } = renderHook(() => useHasPermission('reports:view'))
        expect(result.current).toBe(false)

        act(() => {
            useAuthStore
                .getState()
                .setAuthenticated({ employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' }, permissions: ['reports:view'] })
        })

        expect(result.current).toBe(true)
    })

    // add-frontend-page-access-guard, раздел 1 tasks.md — `useHasPermission` расширяется на
    // `string | string[]` с OR-семантикой (`.some()`), см. design.md "useHasPermission расширяется
    // на массив, а не дублируется".
    describe('массив permissions (OR-семантика)', () => {
        it('возвращает true, когда в сторе есть хотя бы один permission из массива', () => {
            act(() => {
                useAuthStore
                    .getState()
                    .setAuthenticated({ employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' }, permissions: ['shop-accounting:view_accrual'] })
            })

            const { result } = renderHook(() =>
                useHasPermission(['service-accounting:view_accrual', 'shop-accounting:view_accrual']),
            )

            expect(result.current).toBe(true)
        })

        it('возвращает false, когда ни один permission из массива не совпадает с правами пользователя', () => {
            act(() => {
                useAuthStore
                    .getState()
                    .setAuthenticated({ employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' }, permissions: ['reports:view'] })
            })

            const { result } = renderHook(() =>
                useHasPermission(['service-accounting:view_accrual', 'shop-accounting:view_accrual']),
            )

            expect(result.current).toBe(false)
        })

        it('возвращает false для пустого массива permissions', () => {
            act(() => {
                useAuthStore
                    .getState()
                    .setAuthenticated({ employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' }, permissions: ['reports:view'] })
            })

            const { result } = renderHook(() => useHasPermission([]))

            expect(result.current).toBe(false)
        })
    })

    // Dev-байпас (`VITE_AUTH_DISABLED`) читается один раз на модуль-левел константе при импорте
    // (см. useHasPermission.ts), поэтому здесь модуль переимпортируется динамически после
    // `vi.stubEnv`/`vi.resetModules`, а не мокается сам стор.
    describe('dev-байпас (VITE_AUTH_DISABLED)', () => {
        afterEach(() => {
            vi.unstubAllEnvs()
            vi.resetModules()
        })

        it('форсирует true и для массива permissions, когда байпас включён', async () => {
            vi.stubEnv('VITE_AUTH_DISABLED', 'true')
            vi.resetModules()

            const { useHasPermission: useHasPermissionBypassed } = await import('./useHasPermission.ts')

            const { result } = renderHook(() => useHasPermissionBypassed(['roles:manage', 'reports:view']))

            expect(result.current).toBe(true)
        })
    })
})
