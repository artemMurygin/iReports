import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/** See `ui/RuleFormCardFields.spec.tsx`'s identical stub for why this is needed locally. */
if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverStub
}

import { SERVICE_RULE_FORM_CONFIG } from '../../service/model/ruleTypes.ts'
import { createRuleDraft } from '../../model/ruleDraft.ts'
import type { RuleDraft } from '../../model/ruleDraft.ts'

import { RuleFormCard } from './RuleFormCard.tsx'
import type { RuleFormCardProps } from './model/types.ts'

/**
 * add-department-head-salary-rules, FR2-FR4 — end-to-end dispatch check: `RuleFormCard.tsx` must
 * not render `AwardSection` ("Вариант награды") for the 3 new department-level rule types, since
 * their entire field set is already rendered by `RuleFormCardFields.tsx` (see that component's own
 * spec for per-field assertions). `RuleFormCardFields.spec.tsx` exercises the 3 branches directly;
 * this file only covers the one thing that can't be seen from that narrower unit — whether the
 * sibling `AwardSection` in `RuleFormCard.tsx`'s own ternary got skipped.
 */

function makeDraft(type: RuleDraft['type']): RuleDraft {
    return createRuleDraft(type)
}

function renderCard(draft: RuleDraft, overrides: Partial<RuleFormCardProps> = {}) {
    return render(
        <RuleFormCard
            draft={draft}
            index={0}
            config={SERVICE_RULE_FORM_CONFIG}
            allowedRolesByType={{}}
            isRoleTypesLoading={false}
            categories={[]}
            orderTypes={[]}
            onChange={vi.fn()}
            onChangeType={vi.fn()}
            onChangeBorder={vi.fn()}
            onCancel={vi.fn()}
            onSave={vi.fn()}
            onDelete={vi.fn()}
            {...overrides}
        />,
    )
}

describe.each([
    ['DepartmentPercent' as const, 'Процент от факта'],
    ['DepartmentPlanBonus' as const, 'Настроить пороги'],
    ['DepartmentTurnoverBonus' as const, 'Настроить пороги'],
])('RuleFormCard — %s (FR2-FR4)', (type, ownFieldText) => {
    it('never renders the "Вариант награды" award-variant selector', () => {
        renderCard(makeDraft(type))

        expect(screen.queryByText('Вариант награды')).not.toBeInTheDocument()
    })

    it("renders the type's own field set (delegated to RuleFormCardFields)", () => {
        renderCard(makeDraft(type))

        expect(screen.getByText(ownFieldText)).toBeInTheDocument()
    })
})

describe('RuleFormCard — existing types keep rendering "Вариант награды"', () => {
    it('still renders it for a non-department, non-PayPerHour, non-TaskCompletion type', () => {
        renderCard(makeDraft('OrderPayed'))

        expect(screen.getByText('Вариант награды')).toBeInTheDocument()
    })
})
