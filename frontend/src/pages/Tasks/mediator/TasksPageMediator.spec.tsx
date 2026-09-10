import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SalaryRuleDetail, SalaryRuleSummary, Task } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { TasksPageMediator } from './TasksPageMediator.tsx'

// replace-bitrix-task-integration, tasks.md 13.3/13.4 — smoke-проверка собранной страницы поверх
// уже готовых `features/CreateTask`/`features/TaskStatusControl`: пустое состояние по фильтру,
// список с реальным статусом, открытие карточки задачи и модалки создания. Мокаем
// axios-инстанс, тот же приём, что `TaskStatusControl.spec.tsx`/`useTasksPage.spec.tsx`.
//
// add-task-salary-rule-links-comments, tasks.md группа 30 — файл переехал из
// `ui/TasksPage.spec.tsx` вместе с реструктуризацией `TasksPage.tsx` в
// `mediator/TasksPageMediator.tsx` (architecture.md: «выделяется `mediator/TasksPageMediator`»,
// design.md решение делает страницу композицией двух stateful-виджетов — `useTasksPage()` +
// `useSalaryRulePanel()`). Добавлен блок тестов на открытие/закрытие боковой панели правила по
// клику из карточки задачи — весь остальной набор тестов регрессионный, перенесён как есть.
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

// jsdom implements neither — radix-ui's `Select` (`shared/ui-kit/atoms/Select.tsx`, used by
// `FilterBar`) calls both when opening/highlighting the dropdown. No existing spec in this
// project interacts with a radix `Select` via click yet, so these polyfills are scoped to this
// file rather than the shared `src/test/setup.ts`.
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 'task-1',
        direction: 'service',
        title: 'Обзвонить клиентов после диагностики',
        description: 'Позвонить и уточнить впечатления',
        deadline: new Date('2026-09-08'),
        assigneeEmployeeId: 42,
        status: 'IN_PROGRESS',
        closedSuccessfullyAt: null,
        createdAt: new Date('2026-08-01'),
        updatedAt: new Date('2026-08-01'),
        ...overrides,
    }
}

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <TasksPageMediator />
        </QueryClientProvider>,
    )
    return { queryClient }
}

const NOT_FOUND = { isAxiosError: true, response: { status: 404 } }

describe('TasksPageMediator', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.post).mockReset()
    })

    it('renders the empty state when the list has no tasks', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/tasks') return Promise.resolve({ data: [] })
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        renderPage()

        expect(await screen.findByText('Нет задач с такими фильтрами')).toBeInTheDocument()
    })

    it('renders a task row with its real status once the list loads', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/tasks') return Promise.resolve({ data: [makeTask()] })
            if (url === '/v1/directory/employees')
                return Promise.resolve({ data: [{ id: 42, name: 'Олег Фадеев', departmentId: 1 }] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        renderPage()

        // Desktop table and mobile card list both render in jsdom (they only differ by a
        // Tailwind `md:` class jsdom doesn't evaluate), so real content appears twice — the
        // assertions below only need "at least one".
        await waitFor(() =>
            expect(screen.getAllByText('Обзвонить клиентов после диагностики').length).toBeGreaterThan(0),
        )
        expect(screen.getAllByText('В работе').length).toBeGreaterThan(0)
        await waitFor(() => expect(screen.getAllByText('Олег Фадеев').length).toBeGreaterThan(0))
    })

    it('opening a task row shows its full card via TaskStatusControl (GET /v1/tasks/:id)', async () => {
        const user = userEvent.setup()
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/tasks') return Promise.resolve({ data: [makeTask()] })
            if (url === '/v1/tasks/task-1') return Promise.resolve({ data: makeTask() })
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            if (url === '/v1/tasks/task-1/comments') return Promise.resolve({ data: [] })
            if (url === '/v1/tasks/task-1/links') return Promise.resolve({ data: [] })
            if (url === '/v1/service/accounting/salary-rules/by-task/task-1') return Promise.reject(NOT_FOUND)
            if (url === '/v1/service/accounting/salary-accrual-lines/by-task/task-1')
                return Promise.reject(NOT_FOUND)
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        renderPage()
        await waitFor(() =>
            expect(screen.getAllByText('Обзвонить клиентов после диагностики').length).toBeGreaterThan(0),
        )

        // The whole row is a `<button>` now (no separate "Открыть задачу" affordance) — click the
        // title text, same as a real user would, rather than relying on a specific button name.
        await user.click(screen.getAllByText('Обзвонить клиентов после диагностики')[0])

        await waitFor(() => expect(axiosInstance.get).toHaveBeenCalledWith('/v1/tasks/task-1', expect.anything()))
        expect(await screen.findByText('Позвонить и уточнить впечатления')).toBeInTheDocument()
    })

    it('changing the status filter re-requests the list with ?status=DONE', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            if (url === '/v1/tasks') return Promise.resolve({ data: [makeTask()] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        renderPage()
        await waitFor(() =>
            expect(screen.getAllByText('Обзвонить клиентов после диагностики').length).toBeGreaterThan(0),
        )

        // `userEvent.click` on a radix `Select` trigger dispatches pointer events that call
        // `Element.hasPointerCapture`, unimplemented in jsdom — `fireEvent.click` (plain click,
        // no pointer-capture dance) opens/selects the same way without that crash.
        fireEvent.click(screen.getByLabelText('Статус'))
        fireEvent.click(await screen.findByRole('option', { name: 'Выполнена' }))

        await waitFor(() =>
            expect(axiosInstance.get).toHaveBeenCalledWith(
                '/v1/tasks',
                expect.objectContaining({ params: expect.objectContaining({ status: 'DONE' }) }),
            ),
        )
    })

    it('"Новая задача" opens the create-task modal with CreateTaskForm', async () => {
        const user = userEvent.setup()
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/tasks') return Promise.resolve({ data: [] })
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        renderPage()
        await screen.findByText('Нет задач с такими фильтрами')

        await user.click(screen.getAllByRole('button', { name: 'Новая задача' })[0])

        expect(await screen.findByRole('button', { name: 'Создать задачу' })).toBeInTheDocument()
    })

    // add-task-salary-rule-links-comments, tasks.md группа 30 — `spec:
    // tasks/salary-rule-panel#Requirement: Клик по связанному правилу открывает боковую панель с
    // его описанием`. Проверяет ровно то, что mediator обязан оркестровать сам (без чужого
    // internal-состояния): клик по блоку правила внутри карточки задачи -> `useSalaryRulePanel`'s
    // `openRule` -> `SalaryRuleDetailsPanel` монтирует контент и запрашивает правило по `ruleId`.
    describe('панель зарплатного правила (add-task-salary-rule-links-comments)', () => {
        const RULE_SUMMARY: SalaryRuleSummary = {
            id: 'rule-1',
            name: 'Задача: Обзвонить клиентов после диагностики',
            type: 'TaskCompletion',
            targetRole: 'ENGINEER',
        }
        const RULE_DETAIL: SalaryRuleDetail = {
            id: 'rule-1',
            type: 'TaskCompletion',
            name: 'Задача: Обзвонить клиентов после диагностики',
            targetRole: 'ENGINEER',
            config: {
                taskTitleTemplate: 'Обзвонить клиентов',
                isRecurring: false,
                deadlineTemplate: '2026-09-08',
                defaultAmount: 5000,
                taskIdByPeriod: { '2026-09': 'task-1' },
            },
            direction: 'service',
            motivationSchemaName: 'Инженеры',
        }

        function mockTaskWithRule() {
            vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
                if (url === '/v1/tasks') return Promise.resolve({ data: [makeTask()] })
                if (url === '/v1/tasks/task-1') return Promise.resolve({ data: makeTask() })
                if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
                if (url === '/v1/tasks/task-1/comments') return Promise.resolve({ data: [] })
                if (url === '/v1/tasks/task-1/links') return Promise.resolve({ data: [] })
                if (url === '/v1/service/accounting/salary-rules/by-task/task-1')
                    return Promise.resolve({ data: RULE_SUMMARY })
                if (url === '/v1/service/accounting/salary-accrual-lines/by-task/task-1')
                    return Promise.reject(NOT_FOUND)
                if (url === '/v1/service/accounting/salary-rules/rule-1')
                    return Promise.resolve({ data: RULE_DETAIL })
                return Promise.reject(new Error(`unexpected GET ${url}`))
            })
        }

        it('клик по блоку правила на карточке задачи открывает SalaryRuleDetailsPanel (GET .../salary-rules/rule-1)', async () => {
            const user = userEvent.setup()
            mockTaskWithRule()

            renderPage()
            await waitFor(() =>
                expect(screen.getAllByText('Обзвонить клиентов после диагностики').length).toBeGreaterThan(0),
            )
            await user.click(screen.getAllByText('Обзвонить клиентов после диагностики')[0])

            const ruleButton = await screen.findByRole('button', {
                name: /Задача: Обзвонить клиентов после диагностики/,
            })
            await user.click(ruleButton)

            await waitFor(() =>
                expect(axiosInstance.get).toHaveBeenCalledWith('/v1/service/accounting/salary-rules/rule-1', expect.anything()),
            )
            expect(await screen.findByText('Зарплатное правило · только просмотр')).toBeInTheDocument()
            expect(screen.getByText('Инженеры')).toBeInTheDocument()
        })

        it('"Закрыть" на панели правила скрывает её без затрагивания карточки задачи', async () => {
            const user = userEvent.setup()
            mockTaskWithRule()

            renderPage()
            await waitFor(() =>
                expect(screen.getAllByText('Обзвонить клиентов после диагностики').length).toBeGreaterThan(0),
            )
            await user.click(screen.getAllByText('Обзвонить клиентов после диагностики')[0])
            await user.click(
                await screen.findByRole('button', { name: /Задача: Обзвонить клиентов после диагностики/ }),
            )
            await screen.findByText('Зарплатное правило · только просмотр')

            await user.click(screen.getByRole('button', { name: 'Закрыть панель правила' }))

            await waitFor(() =>
                expect(screen.queryByText('Зарплатное правило · только просмотр')).not.toBeInTheDocument(),
            )
            // Задача всё ещё открыта — закрытие панели правила не закрыло карточку задачи.
            expect(screen.getByText('Позвонить и уточнить впечатления')).toBeInTheDocument()
        })
    })
})
