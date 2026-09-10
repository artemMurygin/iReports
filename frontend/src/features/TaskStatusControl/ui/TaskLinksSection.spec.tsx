import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TaskLink } from 'ireports-contracts'

import { TaskLinksSection } from './TaskLinksSection.tsx'

// add-task-salary-rule-links-comments, tasks.md 25.1 — Pencil `baDJe` (Link Row), `F7ai0` (Inline
// Note, `r86qEK`), ошибка невалидного адреса (`cW0k5`). `spec: tasks/links#Requirement: Ссылка
// должна быть валидным адресом`, `spec: tasks/links#Requirement: Ссылка удаляется из карточки задачи`.
const LINKS: TaskLink[] = [
    {
        id: 'link-1',
        taskId: 'task-1',
        url: 'https://disk.irepair.ru/albums/vitrina-2026-09',
        label: 'Фотоальбом сентября',
        createdAt: new Date('2026-09-01'),
    },
    {
        id: 'link-2',
        taskId: 'task-1',
        url: 'https://irepair.ru/docs/regulations',
        createdAt: new Date('2026-09-02'),
    },
]

describe('TaskLinksSection', () => {
    it('пустой список ссылок: показывает Inline Note вместо списка', () => {
        render(<TaskLinksSection links={[]} onAddLink={vi.fn()} onRemoveLink={vi.fn()} />)
        expect(screen.getByText(/Ссылок пока нет/)).toBeInTheDocument()
    })

    it('непустой список: показывает подпись/адрес каждой ссылки, без Inline Note', () => {
        render(<TaskLinksSection links={LINKS} onAddLink={vi.fn()} onRemoveLink={vi.fn()} />)
        expect(screen.getByText('Фотоальбом сентября')).toBeInTheDocument()
        expect(screen.getByText('irepair.ru/docs/regulations', { exact: false })).toBeInTheDocument()
        expect(screen.queryByText(/Ссылок пока нет/)).not.toBeInTheDocument()
    })

    it('клик по крестику ссылки вызывает onRemoveLink(linkId)', async () => {
        const user = userEvent.setup()
        const onRemoveLink = vi.fn()
        render(<TaskLinksSection links={LINKS} onAddLink={vi.fn()} onRemoveLink={onRemoveLink} />)

        await user.click(screen.getAllByRole('button', { name: /Удалить ссылку/ })[0])
        expect(onRemoveLink).toHaveBeenCalledWith('link-1')
    })

    it('невалидный адрес: ошибка показывается, onAddLink не вызывается', async () => {
        const user = userEvent.setup()
        const onAddLink = vi.fn()
        render(<TaskLinksSection links={[]} onAddLink={onAddLink} onRemoveLink={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: /Добавить/ }))
        await user.type(screen.getByLabelText('Адрес ссылки'), 'disk.irepair,ru/albums')
        await user.click(screen.getByRole('button', { name: /Добавить ссылку/ }))

        expect(screen.getByText(/Введите адрес целиком/)).toBeInTheDocument()
        expect(onAddLink).not.toHaveBeenCalled()
    })

    it('валидный адрес: onAddLink вызывается с url/label, форма закрывается', async () => {
        const user = userEvent.setup()
        const onAddLink = vi.fn()
        render(<TaskLinksSection links={[]} onAddLink={onAddLink} onRemoveLink={vi.fn()} />)

        await user.click(screen.getByRole('button', { name: /Добавить/ }))
        await user.type(screen.getByLabelText('Адрес ссылки'), 'https://disk.irepair.ru/albums')
        await user.type(screen.getByLabelText('Подпись ссылки'), 'Альбом')
        await user.click(screen.getByRole('button', { name: /Добавить ссылку/ }))

        expect(onAddLink).toHaveBeenCalledWith('https://disk.irepair.ru/albums', 'Альбом')
        expect(screen.queryByLabelText('Адрес ссылки')).not.toBeInTheDocument()
    })
})
