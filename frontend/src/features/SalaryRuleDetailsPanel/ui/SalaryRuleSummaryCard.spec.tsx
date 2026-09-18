import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SalaryRuleDetail } from 'ireports-contracts'

import { SalaryRuleSummaryCard } from './SalaryRuleSummaryCard.tsx'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 29 (29.1) — по фреймам `XiJo6` (десктоп) и
 * `Nuezn` (мобильный, тот же контент). Проверяем: вид правила (бейдж), направление (чип), параметры
 * (Spec Row), отсутствие кнопок редактирования/сохранения. Роль, схема начисления, «Задача периода»
 * и плашка «только для просмотра» намеренно не отображаются (продуктовая правка после ui-design.md —
 * пользователь счёл их лишними на этой панели).
 */
// split-task-completion-rule-form — isRecurring: false response не несёт буквальных полей задачи
// вовсе (см. `taskCompletionOneOffConfigResponseSchema`, `contracts/commands/salary-rule.ts`), в
// отличие от isRecurring: true ниже.
const TASK_COMPLETION_RULE: SalaryRuleDetail = {
    id: 'rule-1',
    type: 'TaskCompletion',
    name: 'Обновить фото витрины',
    targetRole: 'ENGINEER',
    config: {
        isRecurring: false,
        defaultAmount: 12000,
        taskIdByPeriod: { '2026-09': 'task-1' },
    },
    direction: 'service',
    motivationSchemaName: 'Инженеры',
    isActive: true,
}

describe('SalaryRuleSummaryCard', () => {
    it('показывает вид правила и направление, без роли и схемы начисления', () => {
        render(<SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} />)

        expect(screen.getByText('За выполнение задачи')).toBeInTheDocument()
        expect(screen.getByText('Сервис')).toBeInTheDocument()
        expect(screen.queryByText('Инженер')).not.toBeInTheDocument()
        expect(screen.queryByText('Инженеры')).not.toBeInTheDocument()
        expect(screen.queryByText('Роль')).not.toBeInTheDocument()
        expect(screen.queryByText('Схема начисления')).not.toBeInTheDocument()
    })

    it('показывает направление "Шоп" для направления shop', () => {
        render(<SalaryRuleSummaryCard rule={{ ...TASK_COMPLETION_RULE, direction: 'shop' }} />)

        expect(screen.getByText('Шоп')).toBeInTheDocument()
    })

    it('показывает параметры разового правила «за выполнение задачи», без строки дедлайна', () => {
        render(<SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} />)

        expect(screen.getByText('Вознаграждение')).toBeInTheDocument()
        expect(screen.getByText('12 000 ₽')).toBeInTheDocument()
        expect(screen.getByText('Периодичность')).toBeInTheDocument()
        expect(screen.getByText('Разовая')).toBeInTheDocument()
        // deadlineTemplate у разового правила содержательно не используется (форма создания
        // правила его не запрашивает) и в реальных данных часто пустая строка — строка «Дедлайн»
        // поэтому не показывается вовсе, а не рендерится пустой.
        expect(screen.queryByText('Дедлайн')).not.toBeInTheDocument()
        expect(screen.queryByText('Задача периода')).not.toBeInTheDocument()
    })

    it('показывает "Ежемесячно" и день месяца дедлайна для регулярного правила', () => {
        const recurringRule: SalaryRuleDetail = {
            ...TASK_COMPLETION_RULE,
            config: {
                isRecurring: true,
                taskTitleTemplate: 'Сделать X',
                deadlineTemplate: '2026-09-25',
                deadlinePeriodOffset: 0,
                defaultAmount: TASK_COMPLETION_RULE.config.defaultAmount,
                taskIdByPeriod: TASK_COMPLETION_RULE.config.taskIdByPeriod,
            },
        }

        render(<SalaryRuleSummaryCard rule={recurringRule} />)

        expect(screen.getByText('Ежемесячно')).toBeInTheDocument()
        expect(screen.getByText('Дедлайн')).toBeInTheDocument()
        expect(screen.getByText('25-е число')).toBeInTheDocument()
    })

    it('не показывает плашку "только для просмотра"', () => {
        render(<SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} />)

        expect(
            screen.queryByText('Правило открыто только для просмотра. Изменить его можно на странице зарплатного правила.'),
        ).not.toBeInTheDocument()
    })

    it('не рендерит кнопки редактирования/сохранения', () => {
        render(<SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} />)

        expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('показывает название правила и подпись, без крестика закрытия, если onClose не передан', () => {
        render(<SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} />)

        expect(screen.getByText('Обновить фото витрины')).toBeInTheDocument()
        expect(screen.getByText('Зарплатное правило')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Закрыть/ })).not.toBeInTheDocument()
    })

    it('вызывает onClose по клику на крестик закрытия, если он передан', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        render(<SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} onClose={onClose} />)

        await user.click(screen.getByRole('button', { name: /Закрыть панель правила/ }))

        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('не показывает бейдж "Неактивно" для активного правила', () => {
        render(<SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} />)

        expect(screen.queryByText('Неактивно')).not.toBeInTheDocument()
    })

    it('показывает бейдж "Неактивно" рядом с названием, если rule.isActive === false', () => {
        render(<SalaryRuleSummaryCard rule={{ ...TASK_COMPLETION_RULE, isActive: false }} />)

        expect(screen.getByText('Неактивно')).toBeInTheDocument()
    })

    it('не рендерит кнопку-переключатель активности, если onToggleActive не передан', () => {
        render(<SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} />)

        expect(screen.queryByRole('button', { name: /Деактивировать|Активировать/ })).not.toBeInTheDocument()
    })

    it('показывает кнопку "Деактивировать" для активного правила и вызывает onToggleActive по клику', async () => {
        const user = userEvent.setup()
        const onToggleActive = vi.fn()
        render(<SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} onToggleActive={onToggleActive} />)

        const button = screen.getByRole('button', { name: 'Деактивировать' })
        await user.click(button)

        expect(onToggleActive).toHaveBeenCalledTimes(1)
    })

    it('показывает кнопку "Активировать" для неактивного правила и вызывает onToggleActive по клику', async () => {
        const user = userEvent.setup()
        const onToggleActive = vi.fn()
        render(
            <SalaryRuleSummaryCard
                rule={{ ...TASK_COMPLETION_RULE, isActive: false }}
                onToggleActive={onToggleActive}
            />,
        )

        const button = screen.getByRole('button', { name: 'Активировать' })
        await user.click(button)

        expect(onToggleActive).toHaveBeenCalledTimes(1)
    })

    it('дизейблит кнопку-переключатель, пока isTogglingActive === true', () => {
        render(
            <SalaryRuleSummaryCard rule={TASK_COMPLETION_RULE} onToggleActive={vi.fn()} isTogglingActive={true} />,
        )

        expect(screen.getByRole('button', { name: 'Деактивировать' })).toBeDisabled()
    })
})
