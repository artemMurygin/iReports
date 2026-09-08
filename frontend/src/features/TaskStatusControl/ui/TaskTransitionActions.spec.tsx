import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TaskTransitionActions } from './TaskTransitionActions.tsx'

// replace-bitrix-task-integration, tasks.md 12.1 — рендер-версия того же графа переходов, что
// `model/transitionActions.spec.ts` проверяет как чистую функцию: тут проверяем, что компонент
// РЕАЛЬНО рисует эти кнопки и вызывает onTransition с правильным targetStatus по клику, а для
// терминальных статусов не рисует ничего (returns null).
describe('TaskTransitionActions', () => {
    it('NEW: одна кнопка "Взять в работу", клик зовёт onTransition("IN_PROGRESS")', async () => {
        const user = userEvent.setup()
        const onTransition = vi.fn()
        render(<TaskTransitionActions status="NEW" onTransition={onTransition} />)

        const button = screen.getByRole('button', { name: /Взять в работу/ })
        await user.click(button)
        expect(onTransition).toHaveBeenCalledWith('IN_PROGRESS')
        expect(screen.getAllByRole('button')).toHaveLength(1)
    })

    it('IN_PROGRESS: одна кнопка "Отметить выполненной", клик зовёт onTransition("DONE")', async () => {
        const user = userEvent.setup()
        const onTransition = vi.fn()
        render(<TaskTransitionActions status="IN_PROGRESS" onTransition={onTransition} />)

        await user.click(screen.getByRole('button', { name: /Отметить выполненной/ }))
        expect(onTransition).toHaveBeenCalledWith('DONE')
    })

    it('REWORK: одна кнопка "Вернуть в работу", клик зовёт onTransition("IN_PROGRESS")', async () => {
        const user = userEvent.setup()
        const onTransition = vi.fn()
        render(<TaskTransitionActions status="REWORK" onTransition={onTransition} />)

        await user.click(screen.getByRole('button', { name: /Вернуть в работу/ }))
        expect(onTransition).toHaveBeenCalledWith('IN_PROGRESS')
    })

    it('DONE: три кнопки проверки руководителя, каждая зовёт onTransition со своим статусом', async () => {
        const user = userEvent.setup()
        const onTransition = vi.fn()
        render(<TaskTransitionActions status="DONE" onTransition={onTransition} />)

        expect(screen.getAllByRole('button')).toHaveLength(3)

        await user.click(screen.getByRole('button', { name: /Закрыть успешно/ }))
        expect(onTransition).toHaveBeenLastCalledWith('CLOSED_SUCCESSFULLY')

        await user.click(screen.getByRole('button', { name: /На доработку/ }))
        expect(onTransition).toHaveBeenLastCalledWith('REWORK')

        await user.click(screen.getByRole('button', { name: /Закрыть неуспешно/ }))
        expect(onTransition).toHaveBeenLastCalledWith('CLOSED_UNSUCCESSFULLY')
    })

    it.each(['CLOSED_SUCCESSFULLY', 'CLOSED_UNSUCCESSFULLY'] as const)(
        '%s: не рендерит ни одной кнопки перехода',
        (status) => {
            const { container } = render(<TaskTransitionActions status={status} onTransition={vi.fn()} />)
            expect(container).toBeEmptyDOMElement()
        },
    )

    it('isPending: кнопки отключены (нельзя нажать переход дважды)', () => {
        render(<TaskTransitionActions status="NEW" onTransition={vi.fn()} isPending />)
        expect(screen.getByRole('button', { name: /Взять в работу/ })).toBeDisabled()
    })
})
