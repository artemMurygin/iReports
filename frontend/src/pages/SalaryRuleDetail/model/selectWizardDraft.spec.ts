import { describe, expect, it } from 'vitest'

import { createRuleDraft, type RuleDraft } from '@/features/SalaryRuleForm'

import { selectWizardDraft } from './selectWizardDraft.ts'

/**
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.6) — общая для `service`/`shop`
 * логика "какой раскрытый черновик должен открыть `CreateTaskCompletionRuleWizard`" (используется
 * `useServiceSchemaEditForm.ts`/`useShopSchemaEditForm.ts`). Регрессионный тест на реальный баг,
 * пойманный при ревью: условие ДОЛЖНО опираться на `!draft.confirmed`, а не на `taskId === ''` —
 * иначе Шаг 1 (записывает `taskId` через `onChange`, ещё ДО того, как правило подтверждено) сам
 * же выталкивал бы мастер обратно на обычный `RuleList` прямо между шагами.
 */
function drafts(...patches: Partial<RuleDraft>[]): RuleDraft[] {
    return patches.map((patch) => ({ ...createRuleDraft('TaskCompletion'), ...patch }))
}

describe('selectWizardDraft', () => {
    it('returns null when nothing is expanded', () => {
        expect(selectWizardDraft(drafts({ draftId: 'a' }), null)).toBeNull()
    })

    it('returns null for an expanded draft of a different type', () => {
        const list = drafts({ draftId: 'a', type: 'PayPerHour' })
        expect(selectWizardDraft(list, 'a')).toBeNull()
    })

    it('opens the wizard for a freshly expanded, unconfirmed TaskCompletion draft with no taskId yet', () => {
        const list = drafts({ draftId: 'a', confirmed: false, taskId: '' })
        expect(selectWizardDraft(list, 'a')?.draftId).toBe('a')
    })

    it('keeps the wizard open once Step 1 has written a taskId but the rule is still unconfirmed (Step 2)', () => {
        const list = drafts({ draftId: 'a', confirmed: false, taskId: 'task-42' })
        expect(selectWizardDraft(list, 'a')?.draftId).toBe('a')
    })

    it('closes the wizard once the rule is confirmed (saved via "Сохранить правило")', () => {
        const list = drafts({ draftId: 'a', confirmed: true, taskId: 'task-42' })
        expect(selectWizardDraft(list, 'a')).toBeNull()
    })

    it('never opens the wizard for an already-persisted rule being edited inline', () => {
        // `draftFromRule` always seeds `confirmed: true` for a rule loaded from the backend.
        const list = drafts({ draftId: 'a', confirmed: true, ruleId: 'rule-1', taskId: 'task-1' })
        expect(selectWizardDraft(list, 'a')).toBeNull()
    })
})
