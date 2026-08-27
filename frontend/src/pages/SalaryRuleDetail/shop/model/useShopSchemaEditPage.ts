import type { OrderTypeResponse } from 'ireports-contracts'

import {
    restrictRuleFormConfigToTarget,
    SHOP_RULE_FORM_CONFIG,
    useCatalog,
    useAllowedRolesByType,
    useShopSalaryRuleTypes,
} from '@/features/SalaryRuleForm'

import { useMotivationSchema } from './useMotivationSchema.ts'

/** У правил магазина нет `orderTypeIds` (Фаза 5, docs/service-plan-salary-rule-order-category-filter
 * — вне скоупа для shop, см. PRD) — стабильная пустая ссылка, зеркало `NO_CATEGORIES` у
 * `service/model/useServiceSchemaEditForm.ts`. */
const NO_ORDER_TYPES: OrderTypeResponse[] = []

/** Зеркало `service/model/useServiceSchemaEditPage.ts` — плюс каталог категорий (`useCatalog`),
 * нужный `ProductSold`/`UsedProductSold`. */
export function useShopSchemaEditPage(id: string) {
    const schemaQuery = useMotivationSchema(id)
    const ruleTypesQuery = useShopSalaryRuleTypes()
    const catalogQuery = useCatalog()

    const allowedRolesByType = useAllowedRolesByType(ruleTypesQuery.data)

    return {
        schema: schemaQuery.data ?? null,
        isLoading: schemaQuery.isLoading,
        errorMessage: schemaQuery.error?.message ?? null,
        // TaskCompleted недоступен в схеме отдела — см. `useServiceSchemaEditPage.ts`'s зеркальный
        // комментарий.
        config: restrictRuleFormConfigToTarget(SHOP_RULE_FORM_CONFIG, schemaQuery.data?.target.type ?? null),
        allowedRolesByType,
        isRoleTypesLoading: ruleTypesQuery.isLoading,
        roleTypesError: ruleTypesQuery.error?.message ?? null,
        categories: catalogQuery.data ?? [],
        isCategoriesLoading: catalogQuery.isLoading,
        categoriesError: catalogQuery.error?.message ?? null,
        orderTypes: NO_ORDER_TYPES,
        isOrderTypesLoading: false,
        orderTypesError: null,
    }
}
