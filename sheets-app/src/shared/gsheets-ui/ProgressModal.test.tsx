// Implements FR9, FR13, UX5 of sheets-app-redesign: ProgressModal tests.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProgressModal } from './ProgressModal'

describe('ProgressModal', () => {
    it('FR9: shows title, status line, indeterminate bar and the hint; no percent or ETA', () => {
        render(<ProgressModal open title="Выгружаем цены в RO" message="Парсим файл..." onCancel={() => {}} />)

        expect(screen.getByRole('dialog', { name: 'Выгружаем цены в RO' })).toBeInTheDocument()
        expect(screen.getByTestId('progress-message')).toHaveTextContent('Парсим файл...')
        expect(screen.getByRole('progressbar')).toHaveAttribute('data-indeterminate')
        expect(screen.queryByText(/%/)).not.toBeInTheDocument()
        expect(screen.queryByText(/осталось/)).not.toBeInTheDocument()
        expect(screen.getByText('Не закрывайте таблицу')).toBeInTheDocument()
    })

    it('FR9: omits the status line when there is no message, and the cancel button when it is unavailable', () => {
        render(<ProgressModal open title="Выгружаем РЦ" />)

        expect(screen.queryByTestId('progress-message')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Отмена' })).not.toBeInTheDocument()
    })

    it('UX5: the cancel button and Esc both cancel when available; Esc is inert otherwise', async () => {
        const user = userEvent.setup()
        const onCancel = vi.fn()
        const { rerender } = render(<ProgressModal open title="Создаём" onCancel={onCancel} />)

        await user.click(screen.getByRole('button', { name: 'Отмена' }))
        await user.keyboard('{Escape}')
        expect(onCancel).toHaveBeenCalledTimes(2)

        rerender(<ProgressModal open title="Создаём" />)
        await user.keyboard('{Escape}')
        expect(onCancel).toHaveBeenCalledTimes(2)
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('UX5: keeps focus inside the modal', async () => {
        const user = userEvent.setup()
        render(<ProgressModal open title="Создаём" onCancel={() => {}} />)

        await user.tab()
        await user.tab()
        expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    })
})
