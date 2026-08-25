import { useCallback } from 'react'
import type { OrderTypeResponse, ShopMotivationRequest } from 'ireports-contracts'
import { toast } from 'sonner'

import {
    resolveShopRuleDraft,
    SHOP_RULE_FORM_CONFIG,
    useAllowedRolesByType,
    useCatalog,
    useSalaryRulesDraft,
    useShopSalaryRuleTypes,
} from '@/features/SalaryRuleForm'

import type { DirectionAdapter, SchemaTarget } from '../../model/types.ts'

import { useCreateShopMotivationSchema } from './useCreateShopMotivationSchema.ts'

/** У правил магазина нет поля `orderTypeIds` (`SHOP_RULE_FORM_CONFIG.orderTypeRuleTypes` пуст,
 * Фаза 5, docs/service-plan-salary-rule-order-category-filter) — справочник типов заказов здесь не
 * запрашивается вовсе, стабильная пустая ссылка вместо запроса (зеркало `NO_CATEGORIES` в
 * `service/model/useServiceDirection.ts`). */
const NO_ORDER_TYPES: OrderTypeResponse[] = []

/**
 * Направление "Магазин" целиком — зеркало `service/model/useServiceDirection.ts` (Фаза 4): свой
 * черновик правил (`resolveShopRuleDraft` → `ShopSalaryRuleRequest`), свой конфиг формы, свои
 * запросы (`GET /v1/shop/accounting/salary_role_types` + каталог категорий для
 * `ProductSold`/`UsedProductSold`) и своя мутация (`POST /v1/shop/accounting/motivation-schema`) со
 * своими текстами тостов. Контракты двух направлений не пересекаются ни в одном типе — общая у них
 * только форма адаптера (`DirectionAdapter`), а не форма запроса.
 */
export function useShopDirection(): DirectionAdapter {
    const ruleTypesQuery = useShopSalaryRuleTypes()
    const catalogQuery = useCatalog()
    const createSchema = useCreateShopMotivationSchema()
    const rules = useSalaryRulesDraft(resolveShopRuleDraft)

    const allowedRolesByType = useAllowedRolesByType(ruleTypesQuery.data)

    const { resolvedRules } = rules

    const submit = useCallback(
        (target: SchemaTarget) => {
            if (!resolvedRules) return
            const payload: ShopMotivationRequest = {
                targetType: target.targetType,
                targetId: target.targetId,
                name: target.name,
                rules: resolvedRules,
            }
            createSchema.mutate(payload, {
                onSuccess: (response) => {
                    toast.success('Зарплатная схема магазина сохранена', { description: `ID схемы: ${response.id}` })
                },
                onError: (error) => {
                    toast.error('Не удалось сохранить схему', { description: error.message })
                },
            })
        },
        [createSchema, resolvedRules],
    )

    return {
        config: SHOP_RULE_FORM_CONFIG,
        rules,
        allowedRolesByType,
        isRoleTypesLoading: ruleTypesQuery.isLoading,
        roleTypesError: ruleTypesQuery.error?.message ?? null,
        categories: catalogQuery.data ?? [],
        isCategoriesLoading: catalogQuery.isLoading,
        categoriesError: catalogQuery.error?.message ?? null,
        orderTypes: NO_ORDER_TYPES,
        isOrderTypesLoading: false,
        orderTypesError: null,
        isSubmitting: createSchema.isPending,
        savedSchemaId: createSchema.isSuccess ? createSchema.data.id : null,
        submit,
    }
}
