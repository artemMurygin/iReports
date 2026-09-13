import type { ComponentProps } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { SalaryRuleDetailsPanel } from './SalaryRuleDetailsPanel.tsx'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 29 (29.1) — по прецеденту
 * `TaskStatusControl.spec.tsx`: мокаем `@/shared/api/axios.instance.ts`, проверяем весь путь
 * GET -> UI, включая состояния загрузки/ошибки и футер «Закрыть».
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const RULE_DETAIL = {
    id: 'rule-1',
    type: 'TaskCompletion',
    name: 'Обновить фото витрины',
    targetRole: 'ENGINEER',
    config: {
        taskTitleTemplate: 'Сделать X',
        isRecurring: false,
        deadlineTemplate: '2026-09-30',
        defaultAmount: 12000,
        taskIdByPeriod: { '2026-09': 'task-1' },
    },
    direction: 'service',
    motivationSchemaName: 'Инженеры',
    isActive: true,
}

function renderPanel(
    props: Partial<ComponentProps<typeof SalaryRuleDetailsPanel>> = {},
    queryClient: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
    const onClose = vi.fn()
    render(
        <QueryClientProvider client={queryClient}>
            <SalaryRuleDetailsPanel
                ruleId="rule-1"
                direction="service"
                open={true}
                onClose={onClose}
                {...props}
            />
        </QueryClientProvider>,
    )
    return { onClose, queryClient }
}

describe('SalaryRuleDetailsPanel', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.post).mockReset()
    })

    it('ничего не запрашивает и не рендерит содержимое, пока ruleId === null', () => {
        renderPanel({ ruleId: null, open: false })

        expect(axiosInstance.get).not.toHaveBeenCalled()
    })

    it('показывает состояние загрузки, затем загруженное правило', async () => {
        let resolve!: (value: { data: typeof RULE_DETAIL }) => void
        vi.mocked(axiosInstance.get).mockReturnValue(
            new Promise((r) => {
                resolve = r
            }),
        )

        renderPanel()

        expect(screen.getByText('Загрузка правила…')).toBeInTheDocument()

        resolve({ data: RULE_DETAIL })

        expect(await screen.findByText('Обновить фото витрины')).toBeInTheDocument()
        expect(axiosInstance.get).toHaveBeenCalledWith(
            '/v1/service/accounting/salary-rules/rule-1',
            expect.objectContaining({ signal: expect.anything() }),
        )
    })

    it('показывает сообщение об ошибке, если запрос не удался', async () => {
        vi.mocked(axiosInstance.get).mockRejectedValue({
            isAxiosError: true,
            response: { data: { message: 'Правило не найдено' } },
        })

        renderPanel()

        expect(await screen.findByText('Правило не найдено')).toBeInTheDocument()
    })

    it('кнопка "Закрыть" в футере вызывает onClose', async () => {
        const user = userEvent.setup()
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: RULE_DETAIL })

        const { onClose } = renderPanel()
        await screen.findByText('Обновить фото витрины')

        await user.click(screen.getByRole('button', { name: 'Закрыть' }))

        await waitFor(() => expect(onClose).toHaveBeenCalled())
    })

    it('показывает бейдж "Неактивно" и кнопку "Активировать" для неактивного правила', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: { ...RULE_DETAIL, isActive: false } })

        renderPanel()
        await screen.findByText('Обновить фото витрины')

        expect(screen.getByText('Неактивно')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Активировать' })).toBeInTheDocument()
    })

    it('клик по "Деактивировать" вызывает POST .../deactivate и инвалидирует кэш правила и схемы', async () => {
        const user = userEvent.setup()
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: RULE_DETAIL })
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: undefined })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        renderPanel({}, queryClient)
        await screen.findByText('Обновить фото витрины')

        await user.click(screen.getByRole('button', { name: 'Деактивировать' }))

        await waitFor(() =>
            expect(axiosInstance.post).toHaveBeenCalledWith('/v1/service/accounting/salary-rules/rule-1/deactivate'),
        )
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({ queryKey: expect.arrayContaining(['service', 'rule-1']) }),
            ),
        )
        expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['motivation-schema'] }))
    })

    it('клик по "Активировать" вызывает POST .../activate', async () => {
        const user = userEvent.setup()
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: { ...RULE_DETAIL, isActive: false } })
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: undefined })

        renderPanel()
        await screen.findByText('Обновить фото витрины')

        await user.click(screen.getByRole('button', { name: 'Активировать' }))

        await waitFor(() =>
            expect(axiosInstance.post).toHaveBeenCalledWith('/v1/service/accounting/salary-rules/rule-1/activate'),
        )
    })
})
