import { useCallback } from 'react'
import type { CatalogCategoryResponse, MotivationRequest } from 'ireports-contracts'
import { toast } from 'sonner'

import {
    resolveRuleDraft,
    SERVICE_RULE_FORM_CONFIG,
    useAllowedRolesByType,
    useOrderTypes,
    useSalaryRuleTypes,
    useSalaryRulesDraft,
} from '@/features/SalaryRuleForm'

import type { DirectionAdapter, SchemaTarget } from '../../model/types.ts'

import { useCreateMotivationSchema } from './useCreateMotivationSchema.ts'

/** У сервисных правил нет поля `category` (`SERVICE_RULE_FORM_CONFIG.categoryRuleTypes` пуст), так
 * что каталог магазина здесь не запрашивается вовсе — стабильная пустая ссылка вместо запроса. */
const NO_CATEGORIES: CatalogCategoryResponse[] = []

/**
 * Направление "Сервис" целиком: свой черновик правил (`resolveRuleDraft` →
 * `SalaryRuleRequest`), свой конфиг формы, свои запросы (`GET .../service/accounting/
 * salary_role_types`) и своя мутация (`POST /v1/service/motivation-schema`) с собственными
 * текстами тостов. Наружу отдаёт `DirectionAdapter` — одну и ту же форму, что и
 * `shop/model/useShopDirection.ts`, поэтому странице не нужно знать, какое направление активно
 * (кроме единственного выбора адаптера в `model/useSalaryRulesPage.ts`).
 */
export function useServiceDirection(): DirectionAdapter {
    const ruleTypesQuery = useSalaryRuleTypes()
    const orderTypesQuery = useOrderTypes()
    const createSchema = useCreateMotivationSchema()
    const rules = useSalaryRulesDraft(resolveRuleDraft)

    const allowedRolesByType = useAllowedRolesByType(ruleTypesQuery.data)

    const { resolvedRules } = rules

    const submit = useCallback(
        (target: SchemaTarget) => {
            if (!resolvedRules) return
            const payload: MotivationRequest = {
                targetType: target.targetType,
                targetId: target.targetId,
                name: target.name,
                rules: resolvedRules,
            }
            createSchema.mutate(payload, {
                onSuccess: (response) => {
                    toast.success('Зарплатная схема сервиса сохранена', { description: `ID схемы: ${response.id}` })
                },
                onError: (error) => {
                    toast.error('Не удалось сохранить схему', { description: error.message })
                },
            })
        },
        [createSchema, resolvedRules],
    )

    return {
        config: SERVICE_RULE_FORM_CONFIG,
        rules,
        allowedRolesByType,
        isRoleTypesLoading: ruleTypesQuery.isLoading,
        roleTypesError: ruleTypesQuery.error?.message ?? null,
        categories: NO_CATEGORIES,
        isCategoriesLoading: false,
        categoriesError: null,
        orderTypes: orderTypesQuery.data ?? [],
        isOrderTypesLoading: orderTypesQuery.isLoading,
        orderTypesError: orderTypesQuery.error?.message ?? null,
        isSubmitting: createSchema.isPending,
        savedSchemaId: createSchema.isSuccess ? createSchema.data.id : null,
        submit,
    }
}
