import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PeriodStatusBadge } from './PeriodStatusBadge.tsx'

// Задача 19.4-19.5 (openspec/changes/service-turnover-report): бейдж статуса периода в Filter Row
// — открытый/закрытый текст и отсутствие какой-либо кнопки закрытия/пересчёта (design.md D7).
describe('PeriodStatusBadge', () => {
    it('shows the open-period label when isClosed=false', () => {
        render(<PeriodStatusBadge isClosed={false} />)
        expect(screen.getByText('Открыт · пересчёт каждый час')).toBeInTheDocument()
        expect(screen.getAllByText('Открыт')).not.toHaveLength(0)
        expect(screen.queryByText(/Закрыт/)).not.toBeInTheDocument()
    })

    it('shows the closed-period label when isClosed=true', () => {
        render(<PeriodStatusBadge isClosed={true} />)
        expect(screen.getByText('Период закрыт · данные зафиксированы')).toBeInTheDocument()
        expect(screen.getAllByText('Закрыт')).not.toHaveLength(0)
    })

    it('never renders a close/recalculate button (design.md D7 — not a user action)', () => {
        render(<PeriodStatusBadge isClosed={true} />)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
