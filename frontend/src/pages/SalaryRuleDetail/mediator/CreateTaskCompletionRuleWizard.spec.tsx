import { useState } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import {
    SERVICE_RULE_FORM_CONFIG,
    createRuleDraft,
    type RuleDraft,
    type RuleFormCardContext,
} from '@/features/SalaryRuleForm'

import { CreateTaskCompletionRuleWizard } from './CreateTaskCompletionRuleWizard.tsx'

/**
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.1-14.4) — сборочный тест мастера: Шаг 1
 * (форма создания задачи, `features/CreateTask`) виден первым; после успешного
 * `POST /v1/tasks` мастер сам переключается на Шаг 2 (существующий `RuleFormCard`, уже
 * знающий `taskId`) — переход невозможен раньше (нет отдельной кнопки "Далее" без реального
 * создания задачи). "Отмена" на Шаге 1 не создаёт задачу и вызывает переданный `onCancel`
 * (тот же колбэк, что закрывает/отменяет обычную раскрытую карточку правила).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}))

/** Мини-хозяин, имитирующий реального родителя (`ServiceSchemaEditForm.tsx`): `ruleFormProps.onChange`
 * в реальном приложении приходит из `useSalaryRulesDraft` и правда обновляет `draft` — тест держит
 * такое же маленькое состояние вместо статичного объекта, иначе Шаг 2 никогда не увидел бы
 * записанный мастером `taskId` (тот факт, что `onChange` был вызван С правильным патчем, всё равно
 * проверяется отдельным `onChangeSpy`). */
function Harness({
    onChangeSpy,
    onCancel,
    onSave,
}: {
    onChangeSpy: (id: string, patch: Partial<RuleDraft>) => void
    onCancel: () => void
    onSave: () => null
}) {
    const [draft, setDraft] = useState<RuleDraft>(createRuleDraft('TaskCompletion'))

    const ruleFormProps: RuleFormCardContext = {
        config: SERVICE_RULE_FORM_CONFIG,
        allowedRolesByType: { TaskCompletion: ['ENGINEER', 'ONLINE_MANAGER'] },
        isRoleTypesLoading: false,
        roleTypesError: null,
        isCategoriesLoading: false,
        categoriesError: null,
        orderTypes: [],
        isOrderTypesLoading: false,
        orderTypesError: null,
        onChange: (id, patch) => {
            onChangeSpy(id, patch)
            setDraft((prev) => ({ ...prev, ...patch }))
        },
        onChangeType: vi.fn(),
        onChangeBorder: vi.fn(),
        onCancel,
        onSave,
    }

    return (
        <CreateTaskCompletionRuleWizard
            draft={draft}
            index={0}
            categories={[]}
            ruleFormProps={ruleFormProps}
            onDelete={vi.fn()}
        />
    )
}

function renderWizard() {
    const onChangeSpy = vi.fn()
    const onCancel = vi.fn()
    const onSave = vi.fn(() => null)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <Harness onChangeSpy={onChangeSpy} onCancel={onCancel} onSave={onSave} />
        </QueryClientProvider>,
    )

    return { onChangeSpy, onCancel, onSave }
}

describe('CreateTaskCompletionRuleWizard', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.post).mockReset()
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
        // `features/CreateTask`'s "Ответственный" select is `radix-ui`'s `Select` — jsdom has no
        // real pointer-capture/scroll/resize-observer implementation, Radix reaches for all three
        // while opening a listbox. Stub them the same way Radix's own test suite does; without
        // this the trigger never opens under `@testing-library/user-event`.
        window.HTMLElement.prototype.hasPointerCapture = () => false
        window.HTMLElement.prototype.scrollIntoView = () => {}
        if (!window.ResizeObserver) {
            window.ResizeObserver = class {
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        }
    })

    it('starts on Step 1 — the task creation form, no rule fields yet', () => {
        renderWizard()

        expect(screen.getByText('Сначала создайте задачу')).toBeInTheDocument()
        expect(screen.getByText(/Заголовок/)).toBeInTheDocument()
        expect(screen.queryByText('Сохранить правило')).not.toBeInTheDocument()
    })

    it('moves to Step 2 (the rule form, taskId already known) once the task is created', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({
            data: [{ id: 7, name: 'Иван Иванов', departmentId: 1 }],
        })
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: { id: 'task-42' } })
        const user = userEvent.setup()
        const { onChangeSpy } = renderWizard()

        await user.type(screen.getByLabelText('Заголовок'), 'Обновить фото витрины')
        await user.type(screen.getByLabelText('Дедлайн'), '2026-09-30')
        await user.click(screen.getByRole('combobox', { name: /Ответственный/i }))
        await user.click(await screen.findByRole('option', { name: 'Иван Иванов' }))
        await user.click(screen.getByRole('button', { name: /Далее/ }))

        await waitFor(() => expect(screen.getByText('Сохранить правило')).toBeInTheDocument())

        expect(onChangeSpy).toHaveBeenCalledWith(expect.any(String), { taskId: 'task-42' })
        expect(screen.getByText(/task-42/)).toBeInTheDocument()
    })

    it('cancelling Step 1 calls the same onCancel the normal rule card uses, without creating a task', async () => {
        const user = userEvent.setup()
        const { onCancel } = renderWizard()

        await user.click(screen.getByRole('button', { name: 'Отмена' }))

        expect(onCancel).toHaveBeenCalled()
        expect(axiosInstance.post).not.toHaveBeenCalled()
    })
})
