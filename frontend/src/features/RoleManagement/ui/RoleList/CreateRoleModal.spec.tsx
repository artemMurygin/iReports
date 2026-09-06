import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { CreateRoleModal } from './CreateRoleModal.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.5-20.6); ui-design.md модалка создания роли
 * (фрейм `vKQ8C`) — "вызывает `useRoles().createRole(name)` при сохранении и закрывается".
 */
describe('CreateRoleModal', () => {
    it('вызывает onCreate с введённым названием и закрывается при сохранении', () => {
        const onCreate = vi.fn()
        const onOpenChange = vi.fn()
        render(<CreateRoleModal open onOpenChange={onOpenChange} onCreate={onCreate} />)

        fireEvent.change(screen.getByLabelText('Название роли'), { target: { value: 'Оператор кассы' } })
        fireEvent.click(screen.getByRole('button', { name: 'Создать роль' }))

        expect(onCreate).toHaveBeenCalledWith('Оператор кассы')
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('не вызывает onCreate, когда название пустое', () => {
        const onCreate = vi.fn()
        render(<CreateRoleModal open onOpenChange={vi.fn()} onCreate={onCreate} />)

        expect(screen.getByRole('button', { name: 'Создать роль' })).toBeDisabled()
    })

    it('не рендерится, когда open=false', () => {
        render(<CreateRoleModal open={false} onOpenChange={vi.fn()} onCreate={vi.fn()} />)

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
