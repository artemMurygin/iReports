import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { AccrualLineCardList } from './AccrualLineCardList.tsx'

/**
 * Мобильный аналог `AccrualLinesTable.spec.tsx` — клик по карточке начисления вызывает
 * `onOpenLine(line)`. `documentStatus: 'PAID'` скрывает `AccrualLineActions`, чтобы не тянуть
 * `QueryClientProvider` в этот тест.
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

function renderList(overrides: Partial<React.ComponentProps<typeof AccrualLineCardList>> = {}) {
    const onOpenLine = vi.fn()
    render(
        <AccrualLineCardList
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

describe('AccrualLineCardList', () => {
    it('клик по карточке вызывает onOpenLine(line)', async () => {
        const user = userEvent.setup()
        const { onOpenLine } = renderList()

        // "Почасовая оплата" рендерится и как имя правила, и (через formatLineMeta) как тип
        // правила — обе строки текста внутри одной и той же кликабельной карточки.
        await user.click(screen.getAllByText('Почасовая оплата')[0])

        expect(onOpenLine).toHaveBeenCalledWith(LINE)
    })
})
