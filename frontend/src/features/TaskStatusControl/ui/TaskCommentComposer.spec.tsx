import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TaskCommentComposer } from './TaskCommentComposer.tsx'

// add-task-salary-rule-links-comments, tasks.md 25.1 — форма ввода комментария, выделенная из
// `TaskCommentsSection` в отдельный компонент (Pencil `Q7v9pt`'s `SuDZe` `Footer`, прибитый к низу
// панели). `spec: tasks/comments#Requirement: Пустой комментарий отклоняется`.
describe('TaskCommentComposer', () => {
    it('пустой текст: клик по «Отправить» показывает ошибку, onAddComment не вызывается', async () => {
        const user = userEvent.setup()
        const onAddComment = vi.fn()
        render(<TaskCommentComposer onAddComment={onAddComment} />)

        await user.click(screen.getByRole('button', { name: /Отправить/ }))

        expect(screen.getByText('Комментарий не может быть пустым')).toBeInTheDocument()
        expect(onAddComment).not.toHaveBeenCalled()
    })

    it('непустой текст: клик по «Отправить» вызывает onAddComment(text) и очищает поле', async () => {
        const user = userEvent.setup()
        const onAddComment = vi.fn()
        render(<TaskCommentComposer onAddComment={onAddComment} />)

        const input = screen.getByLabelText('Написать комментарий')
        await user.type(input, 'Новый комментарий')
        await user.click(screen.getByRole('button', { name: /Отправить/ }))

        expect(onAddComment).toHaveBeenCalledWith('Новый комментарий')
        expect(input).toHaveValue('')
    })

    it('Enter отправляет комментарий (без Shift)', async () => {
        const user = userEvent.setup()
        const onAddComment = vi.fn()
        render(<TaskCommentComposer onAddComment={onAddComment} />)

        const input = screen.getByLabelText('Написать комментарий')
        await user.type(input, 'Отправлено по Enter{enter}')

        expect(onAddComment).toHaveBeenCalledWith('Отправлено по Enter')
    })
})
