import { useState } from 'react'
import type { TargetRole } from 'ireports-contracts'

import type { RuleFieldErrors } from '../../../model/formNumberUtils.ts'
import type { RuleFormConfig } from '../../../model/ruleFormConfig.ts'
import type { RuleSaveOutcome } from '../../../model/ruleResolver.ts'
import type { AwardKind, BorderDraft, RuleDraft, RuleType } from '../../../model/ruleDraft.ts'

export type UseRuleFormCardParams = {
    draft: RuleDraft
    config: RuleFormConfig
    allowedRolesByType: Partial<Record<RuleType, TargetRole[]>>
    onChange: (id: string, patch: Partial<RuleDraft>) => void
    onChangeType: (id: string, type: RuleType) => void
    onChangeBorder: (id: string, index: number, patch: Partial<BorderDraft>) => void
    onSave: () => RuleSaveOutcome | null
    onCancel: () => void
}

/**
 * Вся логика раскрытой карточки правила: локальный стейт ошибок полей, сброс роли при смене типа,
 * сброс ошибок при смене варианта награды и привязка `draftId` к колбэкам списка — чтобы сама
 * `RuleFormCard.tsx` осталась сборкой слотов.
 *
 * Ошибки приходят только из резолвера направления (`service/model/ruleFormSchema.ts` /
 * `shop/model/ruleFormSchema.ts`), который вызывает родитель через `onSave` (см.
 * `core/model/useSalaryRulesDraft.ts`, `trySaveExpanded`) — своей zod-логики у карточки нет, она
 * лишь показывает полученный `RuleFieldErrors` и очищает его на следующей успешной попытке.
 */
export function useRuleFormCard({
    draft,
    config,
    allowedRolesByType,
    onChange,
    onChangeType,
    onChangeBorder,
    onSave,
    onCancel,
}: UseRuleFormCardParams) {
    const [errors, setErrors] = useState<RuleFieldErrors>({})

    const allowedRoles = allowedRolesByType[draft.type] ?? []
    const awardOptions = config.awardOptionsByType[draft.type] ?? []
    const showCategory = config.categoryRuleTypes.includes(draft.type)
    const showOrderTypeIds = config.orderTypeRuleTypes.includes(draft.type)

    function patchDraft(patch: Partial<RuleDraft>) {
        onChange(draft.draftId, patch)
    }

    function changeBorder(index: number, patch: Partial<BorderDraft>) {
        onChangeBorder(draft.draftId, index, patch)
    }

    function handleTypeChange(nextType: RuleType) {
        onChangeType(draft.draftId, nextType)
        const nextAllowedRoles = allowedRolesByType[nextType] ?? []
        if (draft.targetRole && !nextAllowedRoles.includes(draft.targetRole)) {
            onChange(draft.draftId, { targetRole: '' })
        }
        setErrors({})
    }

    function handleAwardKindChange(kind: AwardKind) {
        onChange(draft.draftId, { awardKind: kind })
        setErrors({})
    }

    function handleSave() {
        const result = onSave()
        if (result && !result.success) setErrors(result.errors)
    }

    /**
     * Заголовок карточки помечает эту кнопку как «Свернуть правило» (шеврон, см.
     * `RuleFormCardHeader`), но для ещё не подтверждённого черновика `onCancel` не просто
     * сворачивает — он его удаляет (см. инвариант в шапке `core/model/useSalaryRulesDraft.ts`).
     * Раз надпись обещает "свернуть", а поведение — "удалить", подтверждаем это отдельно от
     * футерной кнопки "Отмена" (та уже прямо называет своё действие и второго подтверждения не
     * требует) — но только если пользователь успел что-то ввести (пустой только что добавленный
     * черновик закрывается без лишнего вопроса).
     */
    function handleCollapse() {
        const isDirty = draft.name.trim() !== '' || draft.targetRole !== '' || draft.price.trim() !== ''
        if (!draft.confirmed && isDirty && !window.confirm('Свернуть без сохранения? Введённые данные правила будут потеряны.')) {
            return
        }
        onCancel()
    }

    return {
        errors,
        allowedRoles,
        awardOptions,
        showCategory,
        showOrderTypeIds,
        patchDraft,
        changeBorder,
        handleTypeChange,
        handleAwardKindChange,
        handleSave,
        handleCollapse,
    }
}
