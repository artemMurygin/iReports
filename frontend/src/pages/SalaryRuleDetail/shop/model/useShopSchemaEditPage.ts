import {
    SHOP_RULE_FORM_CONFIG,
    useCatalog,
    useAllowedRolesByType,
    useShopSalaryRuleTypes,
} from '@/features/SalaryRuleForm'

import { useMotivationSchema } from './useMotivationSchema.ts'

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
        config: SHOP_RULE_FORM_CONFIG,
        allowedRolesByType,
        isRoleTypesLoading: ruleTypesQuery.isLoading,
        roleTypesError: ruleTypesQuery.error?.message ?? null,
        categories: catalogQuery.data ?? [],
        isCategoriesLoading: catalogQuery.isLoading,
        categoriesError: catalogQuery.error?.message ?? null,
    }
}
