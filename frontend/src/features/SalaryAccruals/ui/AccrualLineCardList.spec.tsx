import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { AccrualLineCardList } from './AccrualLineCardList.tsx'

/**
 * Мобильный аналог `AccrualLinesTable.spec.tsx` — клик по карточке начисления вызывает
 * `onOpenRule(ruleId)` наравне с `onToggleLine`. `documentStatus: 'PAID'` скрывает
 * `AccrualLineActions`, чтобы не тянуть `QueryClientProvider` в этот тест.
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
    const onToggleLine = vi.fn()
    const onOpenRule = vi.fn()
    render(
        <AccrualLineCardList
            lines={[LINE]}
            direction="service"
            directionLabel="Сервис"
            accrualId="acc-1"
            documentStatus="PAID"
            isLineExpanded={() => false}
            onToggleLine={onToggleLine}
            onOpenRule={onOpenRule}
            footerNote="1 строка"
            footerTotal="Итого 2 000 ₽"
            {...overrides}
        />,
    )
    return { onToggleLine, onOpenRule }
}

describe('AccrualLineCardList', () => {
    it('клик по карточке вызывает onOpenRule(ruleId) и onToggleLine(id)', async () => {
        const user = userEvent.setup()
        const { onToggleLine, onOpenRule } = renderList()

        // "Почасовая оплата" рендерится и как имя правила, и (через formatLineMeta) как тип
        // правила — обе строки текста внутри одной и той же кликабельной карточки.
        await user.click(screen.getAllByText('Почасовая оплата')[0])

        expect(onOpenRule).toHaveBeenCalledWith('rule-1')
        expect(onToggleLine).toHaveBeenCalledWith('line-1')
    })

    it('без onOpenRule клик по карточке не падает — колбэк опционален', async () => {
        const user = userEvent.setup()
        const onToggleLine = vi.fn()
        render(
            <AccrualLineCardList
                lines={[LINE]}
                direction="service"
                directionLabel="Сервис"
                accrualId="acc-1"
                documentStatus="PAID"
                isLineExpanded={() => false}
                onToggleLine={onToggleLine}
                footerNote="1 строка"
                footerTotal="Итого 2 000 ₽"
            />,
        )

        await user.click(screen.getAllByText('Почасовая оплата')[0])

        expect(onToggleLine).toHaveBeenCalledWith('line-1')
    })
})
