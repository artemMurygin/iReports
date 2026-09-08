import { useCallback, useState } from 'react'
import type { MotivationSchemaDetailResponse, OrderTypeResponse, TargetRole } from 'ireports-contracts'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

import {
    draftFromRule,
    resolveRuleDraft,
    useSalaryRulesDraft,
    type RuleFormConfig,
    type RuleType,
} from '@/features/SalaryRuleForm'

import { selectWizardDraft } from '../../model/selectWizardDraft.ts'

import { useUpdateMotivationSchema } from './useUpdateMotivationSchema.ts'

const NO_CATEGORIES: never[] = []

export type UseServiceSchemaEditFormArgs = {
    schema: MotivationSchemaDetailResponse
    config: RuleFormConfig
    allowedRolesByType: Partial<Record<RuleType, TargetRole[]>>
    isRoleTypesLoading: boolean
    roleTypesError: string | null
    orderTypes: OrderTypeResponse[]
    isOrderTypesLoading: boolean
    orderTypesError: string | null
}

/**
 * "Фаза формы" — смонтирована только когда `schema` уже загружена (родитель, `ui/ServiceSchemaEdit.tsx`,
 * рендерит владеющий этим хуком компонент с `key={schema.id}`, а не вызывает хук условно — см. этот
 * компонент и `core/model/useSalaryRulesDraft.ts`'s комментарий про `initialDrafts`). Название схемы
 * и черновики правил инициализируются один раз из `schema` при монтировании; фоновый рефетч того же
 * `id` (см. `useMotivationSchema`) больше не перезаписывает уже начатое редактирование — это
 * осознанное поведение (см. `useSalaryRulesDraft`'s комментарий), а не забытая синхронизация.
 */
export function useServiceSchemaEditForm({
    schema,
    config,
    allowedRolesByType,
    isRoleTypesLoading,
    roleTypesError,
    orderTypes,
    isOrderTypesLoading,
    orderTypesError,
}: UseServiceSchemaEditFormArgs) {
    const navigate = useNavigate()
    const [schemaName, setSchemaName] = useState(schema.name)
    const rules = useSalaryRulesDraft(resolveRuleDraft, schema.rules.map(draftFromRule))
    const updateSchema = useUpdateMotivationSchema(schema.id)

    const { resolvedRules } = rules
    const canSave = schemaName.trim().length > 0 && rules.allDraftsValid && !updateSchema.isPending

    // replace-bitrix-task-integration, раздел 14 tasks.md (14.6) — раскрытый черновик открывает
    // мастер `CreateTaskCompletionRuleWizard` вместо обычной инлайн-карточки (см.
    // `selectWizardDraft`'s комментарий про то, почему условие завязано на `confirmed`, а не на
    // `taskId`). Сама ветка "мастер или список" не здесь (это `model`-хук, не мандатор), а в
    // презентационном `ui/RulesColumn.tsx`, которому просто передаётся уже готовое значение.
    const wizardDraft = selectWizardDraft(rules.drafts, rules.expandedId)
    const wizardDraftIndex = wizardDraft ? rules.drafts.findIndex((draft) => draft.draftId === wizardDraft.draftId) : -1

    // TaskCompletion можно завести только на схему конкретного сотрудника (backend
    // CreateSalaryRuleHandler бросает TaskCompletionRequiresPersonalSchemaException для схемы
    // отдела) — на схеме отдела пункт убирается из дропдауна «Тип правила» при редактировании,
    // как и при создании (`useSalaryRulesPage.ts`).
    const visibleConfig: RuleFormConfig =
        schema.target.type === 'Department'
            ? { ...config, ruleTypeOrder: config.ruleTypeOrder.filter((type) => type !== 'TaskCompletion') }
            : config

    const handleSave = useCallback(() => {
        if (!canSave || !resolvedRules) return
        updateSchema.mutate(
            { name: schemaName.trim(), rules: resolvedRules },
            {
                onSuccess: () => {
                    toast.success('Изменения сохранены')
                    navigate('/salaries/rules')
                },
                onError: (error) => {
                    toast.error('Не удалось сохранить схему', { description: error.message })
                },
            },
        )
    }, [canSave, navigate, resolvedRules, schemaName, updateSchema])

    return {
        schemaName,
        onSchemaNameChange: setSchemaName,
        target: schema.target,
        ruleCount: rules.drafts.length,
        rules,
        wizardDraft,
        wizardDraftIndex,
        config: visibleConfig,
        allowedRolesByType,
        isRoleTypesLoading,
        roleTypesError,
        categories: NO_CATEGORIES,
        isCategoriesLoading: false,
        categoriesError: null,
        orderTypes,
        isOrderTypesLoading,
        orderTypesError,
        canSave,
        isSubmitting: updateSchema.isPending,
        handleSave,
    }
}
