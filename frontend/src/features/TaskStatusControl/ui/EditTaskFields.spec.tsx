import { beforeAll, describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ListEmployeesResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { EditTaskFields, type TaskEditDraft } from './EditTaskFields.tsx'

/**
 * edit-task, tasks.md группа 7 — поля редактирования задачи (заголовок/описание/дедлайн/
 * ответственный) + кнопки Сохранить/Отмена. По прецеденту `TaskLinksSection.spec.tsx` (render +
 * userEvent) и `TaskDetailsPanel.spec.tsx` (мок axios-инстанса + `QueryClientProvider` для
 * `useQuery(tasksApi.getAssigneeEmployees())`, переиспользуемого этим компонентом напрямую).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

// Radix `Select` (`shared/ui-kit/atoms/Select.tsx`, за ним `edit-task-assignee`) вызывает
// `hasPointerCapture`/`releasePointerCapture`/`scrollIntoView` при открытии — jsdom их не
// реализует. Тот же полифилл, что и `WarehouseSelect.spec.tsx` (первый спек, открывающий Radix
// `Select` — см. его WHY).
beforeAll(() => {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
    window.HTMLElement.prototype.releasePointerCapture = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

const EMPLOYEES: ListEmployeesResponse = [
    { id: 1, name: 'Иван Иванов', departmentId: 10 },
    { id: 2, name: 'Пётр Петров', departmentId: 10 },
]

const DRAFT: TaskEditDraft = {
    title: 'Обновить фото витрины',
    description: 'Сделать новые фото для альбома',
    deadline: '2026-09-30',
    assigneeEmployeeId: 1,
}

function renderFields(overrides: Partial<Parameters<typeof EditTaskFields>[0]> = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const props = {
        draft: DRAFT,
        onPatch: vi.fn(),
        onSave: vi.fn(),
        onCancel: vi.fn(),
        canSave: true,
        isPending: false,
        error: null as Error | null,
        ...overrides,
    }
    render(
        <QueryClientProvider client={queryClient}>
            <EditTaskFields {...props} />
        </QueryClientProvider>,
    )
    return props
}

describe('EditTaskFields', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: EMPLOYEES })
    })

    it('рендерит поля со значениями из draft', () => {
        renderFields()

        expect(screen.getByLabelText('Заголовок')).toHaveValue(DRAFT.title)
        expect(screen.getByLabelText('Описание')).toHaveValue(DRAFT.description)
        expect(screen.getByLabelText('Дедлайн')).toHaveValue(DRAFT.deadline)
    })

    it('ввод в поле заголовка вызывает onPatch({ title })', () => {
        const { onPatch } = renderFields()

        fireEvent.change(screen.getByLabelText('Заголовок'), { target: { value: 'Новый заголовок' } })

        expect(onPatch).toHaveBeenCalledWith({ title: 'Новый заголовок' })
    })

    it('ввод в поле описания вызывает onPatch({ description })', () => {
        const { onPatch } = renderFields()

        fireEvent.change(screen.getByLabelText('Описание'), { target: { value: 'Новое описание' } })

        expect(onPatch).toHaveBeenCalledWith({ description: 'Новое описание' })
    })

    it('ввод в поле дедлайна вызывает onPatch({ deadline })', () => {
        const { onPatch } = renderFields()

        fireEvent.change(screen.getByLabelText('Дедлайн'), { target: { value: '2026-10-15' } })

        expect(onPatch).toHaveBeenCalledWith({ deadline: '2026-10-15' })
    })

    it('клик по «Сохранить» вызывает onSave', async () => {
        const user = userEvent.setup()
        const { onSave } = renderFields()

        await user.click(screen.getByRole('button', { name: 'Сохранить' }))

        expect(onSave).toHaveBeenCalled()
    })

    it('«Сохранить» задизейблена, когда canSave === false', () => {
        renderFields({ canSave: false })

        expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    })

    it('«Сохранить» задизейблена, когда isPending === true', () => {
        renderFields({ isPending: true })

        expect(screen.getByRole('button', { name: /Сохранить|Сохранение/ })).toBeDisabled()
    })

    it('клик по «Отмена» вызывает onCancel', async () => {
        const user = userEvent.setup()
        const { onCancel } = renderFields()

        await user.click(screen.getByRole('button', { name: 'Отмена' }))

        expect(onCancel).toHaveBeenCalled()
    })

    it('при наличии error рендерит error.message с role="alert"', () => {
        renderFields({ error: new Error('Не удалось сохранить задачу') })

        expect(screen.getByRole('alert')).toHaveTextContent('Не удалось сохранить задачу')
    })

    it('без error блок ошибки не рендерится', () => {
        renderFields()

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('список ответственных приходит из GET /v1/directory/employees', async () => {
        renderFields()

        await user_click_assignee_trigger()
        expect(await screen.findByRole('option', { name: 'Иван Иванов' })).toBeInTheDocument()
        expect(screen.getByRole('option', { name: 'Пётр Петров' })).toBeInTheDocument()
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/directory/employees', expect.anything())
    })
})

async function user_click_assignee_trigger() {
    const user = userEvent.setup()
    await user.click(screen.getByLabelText('Ответственный'))
}
