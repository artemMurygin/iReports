import { useCallback, useState } from 'react'
import type { CatalogCategoryResponse, ShopMotivationSchemaDetailResponse, TargetRole } from 'ireports-contracts'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

import {
    draftFromShopRule,
    resolveShopRuleDraft,
    useSalaryRulesDraft,
    type RuleFormConfig,
    type RuleType,
} from '@/features/SalaryRuleForm'

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
}: UseShopSchemaEditFormArgs) {
    const navigate = useNavigate()
    const [schemaName, setSchemaName] = useState(schema.name)
    const rules = useSalaryRulesDraft(resolveShopRuleDraft, schema.rules.map(draftFromShopRule))
    const updateSchema = useUpdateMotivationSchema(schema.id)

    const { resolvedRules } = rules
    const canSave = schemaName.trim().length > 0 && rules.allDraftsValid && !updateSchema.isPending

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
        config,
        allowedRolesByType,
        isRoleTypesLoading,
        roleTypesError,
        categories,
        isCategoriesLoading,
        categoriesError,
        canSave,
        isSubmitting: updateSchema.isPending,
        handleSave,
    }
}
