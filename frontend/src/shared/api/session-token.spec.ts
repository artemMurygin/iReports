import { describe, expect, it } from 'vitest'

import { getSessionToken, setSessionToken } from './session-token.ts'

describe('session-token in-memory holder (add-bitrix24-auth-and-rbac, раздел 15)', () => {
    it('возвращает null, пока токен не установлен', () => {
        expect(getSessionToken()).toBeNull()
    })

    it('возвращает установленное значение', () => {
        setSessionToken('abc123')

        expect(getSessionToken()).toBe('abc123')
    })

    it('позволяет очистить токен обратно в null (logout)', () => {
        setSessionToken('abc123')
        setSessionToken(null)

        expect(getSessionToken()).toBeNull()
    })
})
