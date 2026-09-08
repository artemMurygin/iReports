import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { RuleSourcesRail } from './RuleSourcesRail.tsx'

import type { SalaryReportRule } from '@/features/SalaryReportData'

type RuleSource = SalaryReportRule['sources'][number]

function taskCompletionSource(overrides: Partial<RuleSource> = {}): RuleSource {
    return {
        type: 'taskCompletion',
        id: 'task-1',
        ...overrides,
    } as RuleSource
}

/**
 * replace-bitrix-task-integration, tasks.md группа 15 (design.md решение 3, TaskCompletion.
 * calculate()/entity.spec.ts группы 6.11/7): строка-источник типа `taskCompletion` попадает в
 * `sources[]` ТОЛЬКО когда связанная `SalaryTask.isCompleted()` истинна — единственный статус
 * жизненного цикла задачи, при котором это верно, это `CLOSED_SUCCESSFULLY` (design.md решение 3:
 * "только «Закрыта успешно» запускает начисление, не «Выполнена» и не любой другой статус"), а не
 * захардкоженный `"DONE"` (Bitrix-статус, к моменту этого change из системы уже выведен). Никакого
 * отдельного поля статуса в `calculationSourceRefSchema`/`employeeSalaryReportSourceSchema` нет
 * (см. `contracts/commands/salary-rule.ts` — источник `taskCompletion` несёт только `{type, id}`,
 * см. WHY у `TaskCompletion.buildSources()`), поэтому "реальный статус строки" в данном случае —
 * не поле ответа API, а сам этот доменный инвариант, тот же приём, что использовал прежний
 * хардкод, только с верным значением бейджа новой 6-статусной шкалы (группа 10,
 * `shared/ui-kit/atoms/TaskStatusBadge.tsx`) вместо старого 3-статусного
 * `features/SalaryAccruals/ui/TaskStatusBadge.tsx`.
 */
describe('RuleSourcesRail', () => {
    it('renders the CLOSED_SUCCESSFULLY badge (not the hardcoded Bitrix DONE status) for a taskCompletion source', () => {
        render(<RuleSourcesRail sources={[taskCompletionSource()]} />)

        const badge = screen.getByText('Закрыта успешно')
        expect(badge).toHaveAttribute('data-status', 'CLOSED_SUCCESSFULLY')
        expect(screen.queryByText('Выполнено')).not.toBeInTheDocument()
    })

    it('does not render a task status badge for non-taskCompletion sources', () => {
        const { container } = render(
            <RuleSourcesRail
                sources={[{ type: 'order', id: 'order-1', label: '123456' } as RuleSource]}
            />,
        )

        expect(container.querySelector('[data-slot="task-status-badge"]')).not.toBeInTheDocument()
    })
})
