import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { AccrualLinesTable } from './AccrualLinesTable.tsx'

/**
 * Клик по строке начисления должен открывать боковую панель деталей её правила
 * (`features/SalaryRuleDetailsPanel`) через `onOpenRule(ruleId)`, прокинутый страницей
 * (`pages/SalaryAccrualDocument`) — см. `AccrualLinesTable`'s JSDoc: тот же клик одновременно
 * вызывает и `onToggleLine` (локальный аккордеон источников), они не конфликтуют.
 * `documentStatus: 'PAID'` скрывает `AccrualLineActions` — её собственные мутации не нужны
 * этому тесту и иначе потребовали бы `QueryClientProvider`.
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
    const onToggleLine = vi.fn()
    const onOpenRule = vi.fn()
    render(
        <AccrualLinesTable
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

describe('AccrualLinesTable', () => {
    it('клик по строке вызывает onOpenRule(ruleId) и onToggleLine(id)', async () => {
        const user = userEvent.setup()
        const { onToggleLine, onOpenRule } = renderTable()

        // "Почасовая оплата" рендерится и как имя правила, и (через formatLineMeta) как тип
        // правила — обе строки текста внутри одного и того же кликабельного `role="button"`.
        await user.click(screen.getAllByText('Почасовая оплата')[0])

        expect(onOpenRule).toHaveBeenCalledWith('rule-1')
        expect(onToggleLine).toHaveBeenCalledWith('line-1')
    })

    it('без onOpenRule клик по строке не падает — колбэк опционален', async () => {
        const user = userEvent.setup()
        const onToggleLine = vi.fn()
        render(
            <AccrualLinesTable
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

    it('нажатие Enter/Space на строке тоже вызывает onOpenRule(ruleId)', async () => {
        const { onOpenRule } = renderTable()

        screen.getAllByText('Почасовая оплата')[0].closest<HTMLElement>('[role="button"]')?.focus()
        await userEvent.keyboard('{Enter}')

        expect(onOpenRule).toHaveBeenCalledWith('rule-1')
    })
})
