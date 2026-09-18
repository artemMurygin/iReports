import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SalaryAccrualLine, SalaryAccrualResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { SalaryAccrualDocumentPageMediator } from './SalaryAccrualDocumentPageMediator.tsx'

/**
 * Клик по строке начисления открывает `AccrualLineDetailsPanel` со всей строкой (`line`) и
 * `document.direction` — тот же приём мока, что и раньше для `SalaryRuleDetailsPanel` (по образцу
 * `pages/Login/ui/LoginPage.spec.tsx`'s `vi.mock('@/features/Auth', ...)`): полноценный рендер
 * `AccrualLineDetailsPanel` (свой `SidePanel`, `AccrualLineSources`) не нужен здесь — важно только
 * то, что оркеструет сам mediator — с какими пропсами он монтирует панель.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}))

vi.mock('@/features/SalaryAccruals', async () => {
    const actual = await vi.importActual<typeof import('@/features/SalaryAccruals')>('@/features/SalaryAccruals')
    return {
        ...actual,
        AccrualLineDetailsPanel: (props: {
            line: SalaryAccrualLine | null
            direction: string
            open: boolean
            onClose: () => void
        }) =>
            props.open ? (
                <div role="dialog" data-testid="line-panel">
                    <span>lineId:{props.line?.id}</span>
                    <span>direction:{props.direction}</span>
                    <button onClick={props.onClose}>Закрыть панель начисления</button>
                </div>
            ) : null,
    }
})

vi.mock('@/features/TaskStatusControl', () => ({
    TaskDetailsPanel: (props: { taskId: string | null; onClose: () => void }) =>
        props.taskId !== null ? (
            <div role="dialog" data-testid="task-panel">
                <span>taskId:{props.taskId}</span>
                <button onClick={props.onClose}>Закрыть карточку задачи</button>
            </div>
        ) : null,
}))

function makeDocument(overrides: Partial<SalaryAccrualResponse> = {}): SalaryAccrualResponse {
    return {
        id: 'acc-1',
        direction: 'shop',
        period: '2026-09',
        employeeId: 42,
        employeeName: 'Ковалёв Артём',
        departmentId: null,
        status: 'DRAFT',
        isDismissed: false,
        total: 2000,
        linesCount: 1,
        accruedLinesCount: 0,
        createdAt: new Date('2026-09-01'),
        lines: [
            {
                id: 'line-1',
                ruleId: 'rule-1',
                type: 'PayPerHour',
                name: 'Почасовая оплата',
                targetRole: 'ENGINEER',
                salaryBasis: undefined,
                quantity: 10,
                rate: 200,
                amount: 2000,
                originalAmount: 2000,
                sources: [],
                status: 'DRAFT',
                adjustmentComment: null,
                comment: null,
                requiresManualInput: false,
            },
            {
                id: 'line-2',
                ruleId: 'rule-2',
                type: 'TaskCompletion',
                name: 'За выполнение задачи',
                targetRole: 'ENGINEER',
                salaryBasis: undefined,
                quantity: undefined,
                rate: undefined,
                amount: 1000,
                originalAmount: 1000,
                sources: [{ type: 'taskCompletion', id: 'task-42' }],
                status: 'DRAFT',
                adjustmentComment: null,
                comment: null,
                requiresManualInput: false,
            },
        ],
        ...overrides,
    }
}

function renderPage(document: SalaryAccrualResponse) {
    vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
        if (url === '/v1/shop/accounting/salary_accruals/acc-1') return Promise.resolve({ data: document })
        if (url === '/v1/directory/departments') return Promise.resolve({ data: [] })
        return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/salary-accruals/acc-1?direction=shop&period=2026-09']}>
                <Routes>
                    <Route path="/salary-accruals/:id" element={<SalaryAccrualDocumentPageMediator />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('SalaryAccrualDocumentPageMediator', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('клик по строке начисления открывает панель детализации с её line.id и document.direction', async () => {
        const user = userEvent.setup()
        renderPage(makeDocument())

        // Desktop table and mobile card list both render in jsdom (only a Tailwind `md:` class
        // differs) — real content appears twice, click the first match like a real user would.
        await waitFor(() => expect(screen.getAllByText('Почасовая оплата').length).toBeGreaterThan(0))
        await user.click(screen.getAllByText('Почасовая оплата')[0])

        const panel = await screen.findByTestId('line-panel')
        expect(panel).toHaveTextContent('lineId:line-1')
        // document.direction ('shop') решает направление панели — не query-параметр страницы,
        // который в этом тесте намеренно тот же, чтобы отличать источник было нельзя случайно.
        expect(panel).toHaveTextContent('direction:shop')
    })

    it('клик по строке типа TaskCompletion открывает карточку задачи, а не панель начисления', async () => {
        const user = userEvent.setup()
        renderPage(makeDocument())

        await waitFor(() => expect(screen.getAllByText('За выполнение задачи').length).toBeGreaterThan(0))
        await user.click(screen.getAllByText('За выполнение задачи')[0])

        const panel = await screen.findByTestId('task-panel')
        expect(panel).toHaveTextContent('taskId:task-42')
        expect(screen.queryByTestId('line-panel')).not.toBeInTheDocument()
    })

    it('"Закрыть панель начисления" скрывает панель, не трогая документ', async () => {
        const user = userEvent.setup()
        renderPage(makeDocument())

        await waitFor(() => expect(screen.getAllByText('Почасовая оплата').length).toBeGreaterThan(0))
        await user.click(screen.getAllByText('Почасовая оплата')[0])
        await screen.findByTestId('line-panel')

        await user.click(screen.getByRole('button', { name: 'Закрыть панель начисления' }))

        await waitFor(() => expect(screen.queryByTestId('line-panel')).not.toBeInTheDocument())
        expect(screen.getAllByText('Почасовая оплата').length).toBeGreaterThan(0)
    })
})
