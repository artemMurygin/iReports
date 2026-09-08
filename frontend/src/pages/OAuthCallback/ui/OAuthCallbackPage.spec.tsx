import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { OAuthCallbackPage } from './OAuthCallbackPage.tsx'
import { useOAuthCallback } from '../model/useOAuthCallback.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 23 tasks.md; architecture.md `pages/OAuthCallback`: "без
 * собственной визуальной идентичности (короткий "Выполняется вход…")" — страница не по
 * Pencil-фрейму (не входит в ui-design.md), поведение (сверка `state`, отправка `code`) уже
 * покрыто `useOAuthCallback.spec.tsx`, здесь проверяется только подключение статуса к тексту.
 */
vi.mock('../model/useOAuthCallback.ts')

describe('OAuthCallbackPage', () => {
    it('показывает "Выполняется вход…" при статусе processing', () => {
        vi.mocked(useOAuthCallback).mockReturnValue({ status: 'processing' })

        render(<OAuthCallbackPage />)

        expect(screen.getByText('Выполняется вход…')).toBeInTheDocument()
    })

    it('показывает сообщение об ошибке при статусе error', () => {
        vi.mocked(useOAuthCallback).mockReturnValue({ status: 'error' })

        render(<OAuthCallbackPage />)

        expect(screen.getByText(/Не удалось войти/)).toBeInTheDocument()
    })
})
