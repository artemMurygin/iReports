import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { AccessDeniedPage } from './AccessDeniedPage.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 17 tasks.md — `pages/AccessDenied` рендерится
 * `app/route-guard/ui/RouteGuard.tsx` на месте защищённого роута при прямом переходе без нужного
 * permission (раздел 15 tasks.md; та же проверка права, что использует `RequirePermission` из
 * раздела 16 для точечной защиты UI-элементов внутри уже открытой страницы). Тест проверяет, что
 * страница — тонкая обёртка над `shared/ui-kit/organisms/AccessDeniedScreen`, а не дублирует его
 * разметку.
 */
describe('AccessDeniedPage', () => {
    it('рендерит AccessDeniedScreen', () => {
        render(
            <MemoryRouter>
                <AccessDeniedPage />
            </MemoryRouter>,
        )

        expect(screen.getByRole('alert')).toBeInTheDocument()
        expect(screen.getByText('Недостаточно прав для этого раздела')).toBeInTheDocument()
    })
})
