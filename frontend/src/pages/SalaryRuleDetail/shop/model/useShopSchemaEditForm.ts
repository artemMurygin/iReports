import { useCallback, useState } from 'react'
import type {
    CatalogCategoryResponse,
    OrderTypeResponse,
    ShopMotivationSchemaDetailResponse,
    TargetRole,
} from 'ireports-contracts'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

import {
    draftFromShopRule,
    resolveShopRuleDraft,
    useSalaryRulesDraft,
    type RuleFormConfig,
    type RuleType,
} from '@/features/SalaryRuleForm'

import { selectWizardDraft } from '../../model/selectWizardDraft.ts'

import { useUpdateMotivationSchema } from './useUpdateMotivationSchema.ts'

export type UseShopSchemaEditFormArgs = {
    schema: ShopMotivationSchemaDetailResponse
    config: RuleFormConfig
    allowedRolesByType: Partial<Record<RuleType, TargetRole[]>>
    isRoleTypesLoading: boolean
    roleTypesError: string | null
    categories: CatalogCategoryResponse[]
    isCategoriesLoading: boolean
    categoriesError: string | null
    orderTypes: OrderTypeResponse[]
    isOrderTypesLoading: boolean
    orderTypesError: string | null
}

/** Зеркало `service/model/useServiceSchemaEditForm.ts` — та же "фаза формы", смонтированная только
 * после загрузки `schema`, тот же принцип `initialDrafts`/отсутствия ре-синхронизации на фоновый
 * рефетч (см. этого хука комментарий). */
export function useShopSchemaEditForm({
    schema,
    config,
    allowedRolesByType,
    isRoleTypesLoading,
    roleTypesError,
    categories,
    isCategoriesLoading,
    categoriesError,
    orderTypes,
    isOrderTypesLoading,
    orderTypesError,
}: UseShopSchemaEditFormArgs) {
    const navigate = useNavigate()
    const [schemaName, setSchemaName] = useState(schema.name)
    const rules = useSalaryRulesDraft(resolveShopRuleDraft, schema.rules.map(draftFromShopRule))
    const updateSchema = useUpdateMotivationSchema(schema.id)

    const { resolvedRules } = rules
    const canSave = schemaName.trim().length > 0 && rules.allDraftsValid && !updateSchema.isPending

    // replace-bitrix-task-integration, раздел 14 tasks.md (14.6) — зеркало
    // `service/model/useServiceSchemaEditForm.ts`'s `wizardDraft`/`wizardDraftIndex` (обе стороны
    // делят одну и ту же `selectWizardDraft`, см. её комментарий).
    const wizardDraft = selectWizardDraft(rules.drafts, rules.expandedId)
    const wizardDraftIndex = wizardDraft ? rules.drafts.findIndex((draft) => draft.draftId === wizardDraft.draftId) : -1

    // TaskCompletion можно завести только на схему конкретного сотрудника (backend
    // CreateShopSalaryRuleHandler бросает TaskCompletionRequiresPersonalSchemaException для схемы
    // отдела) — на схеме отдела пункт убирается из дропдауна «Тип правила» при редактировании,
    // зеркало `service/model/useServiceSchemaEditForm.ts`.
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
        categories,
        isCategoriesLoading,
        categoriesError,
        orderTypes,
        isOrderTypesLoading,
        orderTypesError,
        canSave,
        isSubmitting: updateSchema.isPending,
        handleSave,
    }
}
