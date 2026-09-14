import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TaskComment } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { TaskCommentsSection } from './TaskCommentsSection.tsx'

// add-task-salary-rule-links-comments, tasks.md 25.1 — Pencil `XSPm8` (`ERP/Molecule/Comment Item`),
// `F7ai0` (Inline Note, `r86qEK`). Форма ввода вынесена в `TaskCommentComposer.spec.tsx` (Pencil
// `Q7v9pt`) — этот файл проверяет только список. `CommentRow` резолвит имя автора через
// `useAssigneeName` (design.md решение 1) -> нужен `QueryClientProvider` + мок `GET
// /v1/directory/employees`.
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const COMMENTS: TaskComment[] = [
    { id: 'c1', taskId: 'task-1', authorEmployeeId: 1, text: 'Первый комментарий', createdAt: new Date('2026-09-10T09:12:00Z') },
    { id: 'c2', taskId: 'task-1', authorEmployeeId: 2, text: 'Второй комментарий', createdAt: new Date('2026-09-10T10:00:00Z') },
]

function renderSection(ui: ReactNode) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('TaskCommentsSection', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('пустой список: показывает Inline Note, заголовок без счётчика', () => {
        renderSection(<TaskCommentsSection comments={[]} />)
        expect(screen.getByText(/Комментариев пока нет/)).toBeInTheDocument()
        expect(screen.getByText('Комментарии')).toBeInTheDocument()
    })

    it('непустой список: показывает тексты комментариев и счётчик в заголовке', () => {
        renderSection(<TaskCommentsSection comments={COMMENTS} />)
        expect(screen.getByText('Комментарии · 2')).toBeInTheDocument()
        expect(screen.getByText('Первый комментарий')).toBeInTheDocument()
        expect(screen.getByText('Второй комментарий')).toBeInTheDocument()
        expect(screen.queryByText(/Комментариев пока нет/)).not.toBeInTheDocument()
    })
})
