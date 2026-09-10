import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * `PercentSliderField` (`DepartmentPercent`'s "Процент от факта", FR2) mounts a radix-ui `Slider`,
 * whose `useSize` hook calls the browser's `ResizeObserver` — jsdom doesn't implement it and this
 * project's shared `src/test/setup.ts` doesn't polyfill it (no other spec in the codebase renders
 * this atom in isolation yet), so it's stubbed locally here rather than in the shared setup file.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverStub
}

import { SERVICE_RULE_FORM_CONFIG } from '../../../service/model/ruleTypes.ts'
import { createRuleDraft, defaultBorders } from '../../../model/ruleDraft.ts'
import type { RuleDraft } from '../../../model/ruleDraft.ts'
import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { WarehouseFieldWarehouse } from '../../WarehouseField'

import { RuleFormCardFields, type RuleFormCardFieldsProps } from './RuleFormCardFields.tsx'

/**
 * add-department-head-salary-rules, FR2-FR4 — the 3 new award-less rule types
 * (`DepartmentPercent`/`DepartmentPlanBonus`/`DepartmentTurnoverBonus`) get a fixed field set per
 * type instead of the usual `AwardSection` "Вариант награды" selector (ui-design.md «Отклонения»).
 * Node IDs referenced below are `design/sallary-first-iteration.pen`'s example cards: desktop
 * `x8OVx` (FR2) / `O9tPQ` (FR3) / `WdQo0` (FR4).
 */

const WAREHOUSES: WarehouseFieldWarehouse[] = [
    { id: 1, name: 'Сервисный центр · Тверская' },
    { id: 2, name: 'Сервисный центр · Полежаевская' },
]

function makeDraft(type: RuleDraft['type'], overrides: Partial<RuleDraft> = {}): RuleDraft {
    return { ...createRuleDraft(type), ...overrides }
}

function renderFields(
    draft: RuleDraft,
    overrides: Partial<RuleFormCardFieldsProps> = {},
    errors: RuleFieldErrors = {},
) {
    const onChange = vi.fn()
    const onChangeType = vi.fn()
    const onChangeBorder = vi.fn()
    const utils = render(
        <RuleFormCardFields
            draft={draft}
            config={SERVICE_RULE_FORM_CONFIG}
            errors={errors}
            allowedRoles={['DEPARTMENT_HEAD']}
            isRoleTypesLoading={false}
            categories={[]}
            showCategory={false}
            orderTypes={[]}
            showOrderTypeIds={false}
            onChange={onChange}
            onChangeType={onChangeType}
            onChangeBorder={onChangeBorder}
            warehouses={WAREHOUSES}
            {...overrides}
        />,
    )
    return { ...utils, onChange, onChangeType, onChangeBorder }
}

describe('RuleFormCardFields — DepartmentPercent (FR2)', () => {
    it('renders Категория + База начисления + Процент, and no "Вариант награды" text', () => {
        renderFields(makeDraft('DepartmentPercent'))

        expect(screen.getByText('Категория')).toBeInTheDocument()
        expect(screen.getByText('База начисления')).toBeInTheDocument()
        expect(screen.getByText('Процент от факта')).toBeInTheDocument()
        expect(screen.queryByText('Вариант награды')).not.toBeInTheDocument()
    })

    it('does not render Сумма/Склад/Пороги fields belonging to the other 2 types', () => {
        renderFields(makeDraft('DepartmentPercent'))

        expect(screen.queryByText('Фиксированная сумма, ₽')).not.toBeInTheDocument()
        expect(screen.queryByText('Склад')).not.toBeInTheDocument()
        expect(screen.queryByText('Настроить пороги')).not.toBeInTheDocument()
    })

    it('reports percent edits via onChange', async () => {
        const user = userEvent.setup()
        const { onChange } = renderFields(makeDraft('DepartmentPercent', { percent: '' }))

        const slider = screen.getByRole('slider')
        slider.focus()
        await user.keyboard('{ArrowRight}')

        expect(onChange).toHaveBeenCalledWith({ percent: expect.any(String) })
    })

    it('surfaces percent/salaryBasis/category field errors', () => {
        renderFields(
            makeDraft('DepartmentPercent'),
            {},
            {
                percent: 'Укажите процент',
                salaryBasis: 'Выберите базу начисления',
                category: 'Ошибка категории',
            },
        )

        expect(screen.getByText('Укажите процент')).toBeInTheDocument()
        expect(screen.getByText('Выберите базу начисления')).toBeInTheDocument()
        expect(screen.getByText('Ошибка категории')).toBeInTheDocument()
    })
})

describe('RuleFormCardFields — DepartmentPlanBonus (FR3)', () => {
    it('renders Категория + База начисления + Сумма + пороги, and no "Вариант награды" text', () => {
        renderFields(makeDraft('DepartmentPlanBonus'))

        expect(screen.getByText('Категория')).toBeInTheDocument()
        expect(screen.getByText('База начисления')).toBeInTheDocument()
        expect(screen.getByText('Фиксированная сумма, ₽')).toBeInTheDocument()
        expect(screen.getByText('Настроить пороги')).toBeInTheDocument()
        expect(screen.queryByText('Вариант награды')).not.toBeInTheDocument()
    })

    it('does not render the FR4-only Склад/План коэфф. fields', () => {
        renderFields(makeDraft('DepartmentPlanBonus'))

        expect(screen.queryByText('Склад')).not.toBeInTheDocument()
        expect(screen.queryByText('План коэффициента оборачиваемости')).not.toBeInTheDocument()
    })

    it('reports the fixed amount via onChange', async () => {
        const user = userEvent.setup()
        const { onChange } = renderFields(makeDraft('DepartmentPlanBonus', { price: '' }))

        await user.type(screen.getByPlaceholderText('25000'), '5')

        expect(onChange).toHaveBeenCalledWith({ price: '5' })
    })

    it('forwards border edits via onChangeBorder once the thresholds editor is expanded', async () => {
        const user = userEvent.setup()
        const borders = defaultBorders().map((border, index) => (index === 0 ? { ...border, name: '' } : border))
        const { onChangeBorder } = renderFields(
            makeDraft('DepartmentPlanBonus', { percentBorders: borders, thresholdsExpanded: true }),
        )

        const nameInputs = screen.getAllByPlaceholderText('Название')
        await user.type(nameInputs[0], 'X')

        expect(onChangeBorder).toHaveBeenCalledWith(0, { name: 'X' })
    })

    it('starts collapsed and calls onChange to expand on "Настроить пороги"', async () => {
        const user = userEvent.setup()
        const { onChange } = renderFields(
            makeDraft('DepartmentPlanBonus', { percentBorders: defaultBorders(), thresholdsExpanded: false }),
        )

        await user.click(screen.getByText('Настроить пороги'))

        expect(onChange).toHaveBeenCalledWith({ thresholdsExpanded: true })
    })

    it('surfaces price/salaryBasis/thresholds field errors', () => {
        renderFields(
            makeDraft('DepartmentPlanBonus'),
            {},
            {
                price: 'Укажите фиксированную сумму',
                salaryBasis: 'Выберите базу начисления',
                thresholds: 'Нужно ровно 3 порога',
            },
        )

        expect(screen.getByText('Укажите фиксированную сумму')).toBeInTheDocument()
        expect(screen.getByText('Выберите базу начисления')).toBeInTheDocument()
    })
})

describe('RuleFormCardFields — DepartmentTurnoverBonus (FR4)', () => {
    it('renders Склад + Категория + Сумма + План коэфф. + пороги, and no "Вариант награды" text', () => {
        renderFields(makeDraft('DepartmentTurnoverBonus'))

        expect(screen.getByText('Склад')).toBeInTheDocument()
        expect(screen.getByText('Категория')).toBeInTheDocument()
        expect(screen.getByText('Фиксированная сумма, ₽')).toBeInTheDocument()
        expect(screen.getByText('План коэффициента оборачиваемости')).toBeInTheDocument()
        expect(screen.getByText('Настроить пороги')).toBeInTheDocument()
        expect(screen.queryByText('Вариант награды')).not.toBeInTheDocument()
    })

    it('does not render the "База начисления" tabs (FR4 has no salary basis)', () => {
        renderFields(makeDraft('DepartmentTurnoverBonus'))

        expect(screen.queryByText('База начисления')).not.toBeInTheDocument()
    })

    it('lists the warehouses and reports a selection via onChange', async () => {
        const user = userEvent.setup()
        const { onChange } = renderFields(makeDraft('DepartmentTurnoverBonus', { warehouseId: '' }))

        await user.click(screen.getByRole('button', { name: /выберите склад/i }))
        await user.click(await screen.findByText('Сервисный центр · Полежаевская'))

        expect(onChange).toHaveBeenCalledWith({ warehouseId: '2' })
    })

    it('reports the plan turnover ratio via onChange', async () => {
        const user = userEvent.setup()
        const { onChange } = renderFields(makeDraft('DepartmentTurnoverBonus', { planTurnoverRatio: '' }))

        await user.type(screen.getByPlaceholderText('1,0'), '2')

        expect(onChange).toHaveBeenCalledWith({ planTurnoverRatio: '2' })
    })

    it('surfaces warehouseId/planTurnoverRatio field errors', () => {
        renderFields(
            makeDraft('DepartmentTurnoverBonus'),
            {},
            {
                warehouseId: 'Склад обязателен',
                planTurnoverRatio: 'Укажите план коэффициента оборачиваемости',
            },
        )

        expect(screen.getByText('Склад обязателен')).toBeInTheDocument()
        expect(screen.getByText('Укажите план коэффициента оборачиваемости')).toBeInTheDocument()
    })

    it('shows a loading/error state for the warehouse list when supplied', () => {
        renderFields(makeDraft('DepartmentTurnoverBonus'), { isWarehousesLoading: true, warehouses: [] })

        expect(screen.getByRole('button', { name: /загрузка/i })).toBeDisabled()
    })
})

describe('RuleFormCardFields — other rule types render none of the department branches', () => {
    it('renders nothing department-specific for PayPerHour', () => {
        renderFields(makeDraft('PayPerHour'))

        expect(screen.queryByText('Процент от факта')).not.toBeInTheDocument()
        expect(screen.queryByText('Склад')).not.toBeInTheDocument()
        expect(screen.queryByText('Настроить пороги')).not.toBeInTheDocument()
    })
})
