import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DeleteTaskDialog } from './DeleteTaskDialog.tsx'

// delete-task-frontend, tasks.md 3.1 — презентационный confirm-диалог удаления задачи, по образцу
// `features/SalaryRuleForm/ui/RuleFormCard/ui/DeleteRuleTaskDialog.tsx`: рендер заголовка/предупреждения,
// проброс onConfirm/onCancel, idle/pending/error состояния кнопки подтверждения, блокировка закрытия
// во время isPending.
describe('DeleteTaskDialog', () => {
    it('рендерит заголовок с названием задачи и предупреждение о безвозвратности', () => {
        render(
            <DeleteTaskDialog
                isOpen
                taskTitle="Починить экран"
                isPending={false}
                error={null}
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        expect(screen.getByText('Удалить задачу «Починить экран»?')).toBeInTheDocument()
        expect(screen.getByText(/безвозвратно/)).toBeInTheDocument()
    })

    it('клик «Удалить» вызывает onConfirm', async () => {
        const user = userEvent.setup()
        const onConfirm = vi.fn()
        render(
            <DeleteTaskDialog
                isOpen
                taskTitle="Починить экран"
                isPending={false}
                error={null}
                onConfirm={onConfirm}
                onCancel={vi.fn()}
            />,
        )

        await user.click(screen.getByRole('button', { name: /Удалить/ }))
        expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('клик «Отмена» вызывает onCancel', async () => {
        const user = userEvent.setup()
        const onCancel = vi.fn()
        render(
            <DeleteTaskDialog
                isOpen
                taskTitle="Починить экран"
                isPending={false}
                error={null}
                onConfirm={vi.fn()}
                onCancel={onCancel}
            />,
        )

        await user.click(screen.getByRole('button', { name: 'Отмена' }))
        expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('закрытие диалога (Escape) вызывает onCancel', async () => {
        const user = userEvent.setup()
        const onCancel = vi.fn()
        render(
            <DeleteTaskDialog
                isOpen
                taskTitle="Починить экран"
                isPending={false}
                error={null}
                onConfirm={vi.fn()}
                onCancel={onCancel}
            />,
        )

        await user.keyboard('{Escape}')
        expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('isPending: кнопка подтверждения показывает Loader2, недоступна повторному клику, закрытие заблокировано', async () => {
        const user = userEvent.setup()
        const onConfirm = vi.fn()
        const onCancel = vi.fn()
        render(
            <DeleteTaskDialog
                isOpen
                taskTitle="Починить экран"
                isPending
                error={null}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />,
        )

        const confirmButton = screen.getByRole('button', { name: /Удаляем/ })
        expect(confirmButton).toBeDisabled()
        expect(confirmButton.querySelector('.lucide-loader-circle')).not.toBeNull()

        await user.click(confirmButton)
        expect(onConfirm).not.toHaveBeenCalled()

        await user.keyboard('{Escape}')
        expect(onCancel).not.toHaveBeenCalled()
    })

    it('при непустом error показывается блок ошибки с текстом сообщения и иконкой RotateCw на кнопке подтверждения', () => {
        render(
            <DeleteTaskDialog
                isOpen
                taskTitle="Починить экран"
                isPending={false}
                error="Не удалось удалить задачу."
                onConfirm={vi.fn()}
                onCancel={vi.fn()}
            />,
        )

        expect(screen.getByText('Не удалось удалить задачу.')).toBeInTheDocument()
        const confirmButton = screen.getByRole('button', { name: /Повторить/ })
        expect(confirmButton.querySelector('.lucide-rotate-cw')).not.toBeNull()
    })
})
