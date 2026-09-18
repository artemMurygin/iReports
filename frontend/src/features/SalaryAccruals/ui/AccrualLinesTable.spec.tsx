import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { AccrualLinesTable } from './AccrualLinesTable.tsx'

/**
 * Клик по строке начисления вызывает `onOpenLine(line)` — открывает боковую панель детализации
 * источников (`features/SalaryAccruals`'s `AccrualLineDetailsPanel`), оркеструемую страницей
 * (`pages/SalaryAccrualDocument`). `documentStatus: 'PAID'` скрывает `AccrualLineActions` — её
 * собственные мутации не нужны этому тесту и иначе потребовали бы `QueryClientProvider`.
 */
const LINE: SalaryAccrualLine = {
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
}

function renderTable(overrides: Partial<React.ComponentProps<typeof AccrualLinesTable>> = {}) {
    const onOpenLine = vi.fn()
    render(
        <AccrualLinesTable
            lines={[LINE]}
            direction="service"
            directionLabel="Сервис"
            accrualId="acc-1"
            documentStatus="PAID"
            onOpenLine={onOpenLine}
            footerNote="1 строка"
            footerTotal="Итого 2 000 ₽"
            {...overrides}
        />,
    )
    return { onOpenLine }
}

describe('AccrualLinesTable', () => {
    it('клик по строке вызывает onOpenLine(line)', async () => {
        const user = userEvent.setup()
        const { onOpenLine } = renderTable()

        // "Почасовая оплата" рендерится и как имя правила, и (через formatLineMeta) как тип
        // правила — обе строки текста внутри одного и того же кликабельного `role="button"`.
        await user.click(screen.getAllByText('Почасовая оплата')[0])

        expect(onOpenLine).toHaveBeenCalledWith(LINE)
    })

    it('нажатие Enter/Space на строке тоже вызывает onOpenLine(line)', async () => {
        const { onOpenLine } = renderTable()

        screen.getAllByText('Почасовая оплата')[0].closest<HTMLElement>('[role="button"]')?.focus()
        await userEvent.keyboard('{Enter}')

        expect(onOpenLine).toHaveBeenCalledWith(LINE)
    })
})
