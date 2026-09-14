import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RuleDetailSection } from './RuleDetailSection.tsx'

import type { SalaryReportRule } from '@/features/SalaryReportData'

type RuleSource = SalaryReportRule['sources'][number]

function baseRule(overrides: Partial<SalaryReportRule> = {}): SalaryReportRule {
    return {
        ruleId: 'rule-1',
        type: 'ServiceCompleted',
        name: 'Правило',
        targetRole: 'ENGINEER',
        amount: { fact: 100, prognose: 200 },
        sources: [],
        ...overrides,
    } as SalaryReportRule
}

function taskCompletionSource(overrides: Partial<RuleSource> = {}): RuleSource {
    return {
        type: 'taskCompletion',
        id: 'task-1',
        ...overrides,
    } as RuleSource
}

/**
 * Перенесено дословно из прежней `RuleSourcesRail.spec.tsx` (replace-bitrix-task-integration,
 * tasks.md группа 15) вместе с самим инвариантом при переверстке под `fGbpF`: источник
 * `taskCompletion` попадает в `sources[]` ТОЛЬКО когда связанная `SalaryTask.isCompleted()`
 * истинна — единственный статус, при котором это верно, `CLOSED_SUCCESSFULLY` (design.md решение
 * 3), а не захардкоженный Bitrix-статус `"DONE"` (уже выведен из системы).
 */
describe('RuleDetailSection', () => {
    it('renders the CLOSED_SUCCESSFULLY badge (not the hardcoded Bitrix DONE status) for a taskCompletion source', async () => {
        const user = userEvent.setup()
        render(<RuleDetailSection rule={baseRule({ sources: [taskCompletionSource()] })} />)
        await user.click(screen.getByRole('button'))

        const badge = screen.getByText('Закрыта успешно')
        expect(badge).toHaveAttribute('data-status', 'CLOSED_SUCCESSFULLY')
        expect(screen.queryByText('Выполнено')).not.toBeInTheDocument()
    })

    it('does not render a task status badge for non-taskCompletion sources', async () => {
        const user = userEvent.setup()
        const { container } = render(
            <RuleDetailSection
                rule={baseRule({ sources: [{ type: 'order', id: 'order-1', label: '123456' } as RuleSource] })}
            />,
        )
        await user.click(screen.getByRole('button'))

        expect(container.querySelector('[data-slot="task-status-badge"]')).not.toBeInTheDocument()
    })

    it('does not render a documents chip or order table for a rule without sources', () => {
        render(<RuleDetailSection rule={baseRule({ sources: [] })} />)

        expect(screen.queryByText(/документ/)).not.toBeInTheDocument()
        expect(screen.queryByText('Заказ')).not.toBeInTheDocument()
    })
})
