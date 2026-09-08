import type { RuleDraft } from '@/features/SalaryRuleForm'

/**
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.6) — общая для `service/model/
 * useServiceSchemaEditForm.ts` и `shop/model/useShopSchemaEditForm.ts` логика: должен ли раскрытый
 * сейчас черновик открыть `CreateTaskCompletionRuleWizard` (`pages/SalaryRuleDetail/mediator`)
 * вместо обычной инлайн-карточки `RuleFormCard`.
 *
 * Условие — `!draft.confirmed`, а НЕ `draft.taskId === ''`: мастер должен оставаться открытым на
 * ПРОТЯЖЕНИИ обоих его шагов, а Шаг 1 записывает `taskId` в черновик (через `ruleFormProps.onChange`)
 * ЗАДОЛГО до того, как правило будет подтверждено (Шаг 2, "Сохранить правило"). Если бы условие
 * зависело от самого `taskId`, отрисовка Шага 1 сразу же выталкивала бы мастер обратно на обычный
 * `RuleList` в момент, когда `taskId` появляется, — видимый результат совпал бы (`RuleList` тоже
 * показывает `RuleFormCard` для раскрытого черновика), но собственный переход
 * `useCreateTaskCompletionRuleWizard`'s хука на шаг `'rule'` никогда бы не успевал отрисоваться.
 * `confirmed` становится `true` только по успешному сохранению (`trySaveExpanded`,
 * `core/model/useSalaryRulesDraft.ts`) — тот самый момент, когда мастер и должен закрыться сам.
 * Уже персистентное правило (`draftFromRule`/`draftFromShopRule` сразу ставят `confirmed: true`)
 * никогда не открывает мастер повторно, даже будучи раскрытым для обычного редактирования.
 */
export function selectWizardDraft(drafts: RuleDraft[], expandedId: string | null): RuleDraft | null {
    return (
        drafts.find(
            (draft) => draft.draftId === expandedId && draft.type === 'TaskCompletion' && !draft.confirmed,
        ) ?? null
    )
}
