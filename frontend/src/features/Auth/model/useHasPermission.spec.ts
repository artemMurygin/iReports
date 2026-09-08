import { describe, expect, it, beforeEach } from 'vitest'
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
})
