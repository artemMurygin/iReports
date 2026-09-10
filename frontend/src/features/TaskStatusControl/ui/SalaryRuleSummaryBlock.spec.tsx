import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SalaryAccrualLineSummary, SalaryRuleSummary } from 'ireports-contracts'

import { SalaryRuleSummaryBlock } from './SalaryRuleSummaryBlock.tsx'

// add-task-salary-rule-links-comments, tasks.md 26.1 — Pencil `QmF9j` (`yZE5X` правило+начисление,
// `r86qEK` правило без начисления — Rule Divider/Accrual Row отключены, `cW0k5` блока нет вовсе).
const RULE: SalaryRuleSummary = {
    id: 'rule-1',
    name: 'Задача: Обновить фото витрины',
    type: 'TaskCompletion',
    targetRole: 'ENGINEER',
}

const ACCRUAL: SalaryAccrualLineSummary = {
    id: 'line-1',
    amount: 12000,
    status: 'ACCRUED',
}

describe('SalaryRuleSummaryBlock', () => {
    it('summary === null: блок не рендерится вовсе (cW0k5)', () => {
        const { container } = render(
            <SalaryRuleSummaryBlock summary={null} accrual={null} direction="service" />,
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('summary без accrual: показывает правило, строку начисления и разделитель не рендерит (r86qEK)', () => {
        render(<SalaryRuleSummaryBlock summary={RULE} accrual={null} direction="service" />)

        expect(screen.getByText('Задача: Обновить фото витрины')).toBeInTheDocument()
        expect(screen.getByText(/За выполнение задачи · Инженер · Сервис/)).toBeInTheDocument()
        expect(screen.queryByText('Начислено за задачу')).not.toBeInTheDocument()
    })

    it('summary + accrual: показывает сумму и статус строки (yZE5X)', () => {
        render(<SalaryRuleSummaryBlock summary={RULE} accrual={ACCRUAL} direction="service" />)

        expect(screen.getByText('Начислено за задачу')).toBeInTheDocument()
        expect(screen.getByText('12 000 ₽')).toBeInTheDocument()
        expect(screen.getByText('Проведено')).toBeInTheDocument()
    })

    it('клик по блоку с onOpen вызывает onOpen({ruleId, direction})', async () => {
        const user = userEvent.setup()
        const onOpen = vi.fn()
        render(<SalaryRuleSummaryBlock summary={RULE} accrual={null} direction="shop" onOpen={onOpen} />)

        await user.click(screen.getByRole('button'))
        expect(onOpen).toHaveBeenCalledWith({ ruleId: 'rule-1', direction: 'shop' })
    })

    it('без onOpen блок не кликабелен (не рендерится как button)', () => {
        render(<SalaryRuleSummaryBlock summary={RULE} accrual={null} direction="service" />)
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
})
