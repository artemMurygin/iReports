import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { GoodsTurnoverReportLineResponse } from 'ireports-contracts'

import { GoodsTurnoverReportBody } from './GoodsTurnoverReportBody.tsx'

function line(overrides: Partial<GoodsTurnoverReportLineResponse> = {}): GoodsTurnoverReportLineResponse {
    return {
        categoryId: 1,
        categoryName: 'Дисплеи',
        categoryParentId: null,
        warehouseId: 1,
        warehouseName: 'Тверская',
        outcomeQuantity: 5,
        outcomeSum: 50_000,
        stockQuantity: 3,
        stockSum: 30_000,
        turnoverRatio: 1.5,
        ...overrides,
    }
}

// TDD задачи 19.5-19.6 (openspec/changes/service-turnover-report): презентационный компонент,
// который решает, что показать вместо таблицы — ошибку/«ещё не пересчитан»/саму таблицу — без
// участия страницы-медиатора (frontend/CLAUDE.md).
describe('GoodsTurnoverReportBody', () => {
    it('renders the error card with the backend message and wires the retry button when error is set', async () => {
        const user = userEvent.setup()
        const onRetry = vi.fn()
        render(
            <GoodsTurnoverReportBody
                error="Не удалось загрузить отчёт по оборачиваемости товаров: 502"
                onRetry={onRetry}
                lines={undefined}
                rows={[]}
            />,
        )

        expect(screen.getByText('Не удалось загрузить отчёт')).toBeInTheDocument()
        expect(screen.getByText('Не удалось загрузить отчёт по оборачиваемости товаров: 502')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: /Повторить/ }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('renders the "not recalculated" card without any CTA when the period has zero saved lines', () => {
        render(<GoodsTurnoverReportBody error={null} onRetry={vi.fn()} lines={[]} rows={[]} />)

        expect(screen.getByText('Отчёт ещё не пересчитан')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('renders the table with the filtered rows when the report has data and no error', () => {
        const rows = [line()]
        render(<GoodsTurnoverReportBody error={null} onRetry={vi.fn()} lines={rows} rows={rows} />)

        expect(screen.getByText('Дисплеи')).toBeInTheDocument()
        expect(screen.queryByText('Отчёт ещё не пересчитан')).not.toBeInTheDocument()
        expect(screen.queryByText('Не удалось загрузить отчёт')).not.toBeInTheDocument()
    })

    it('prefers the error state over an empty/undefined lines list', () => {
        render(<GoodsTurnoverReportBody error="Сеть недоступна" onRetry={vi.fn()} lines={[]} rows={[]} />)

        expect(screen.getByText('Не удалось загрузить отчёт')).toBeInTheDocument()
        expect(screen.queryByText('Отчёт ещё не пересчитан')).not.toBeInTheDocument()
    })
})
