import {
    useAllowedRolesByType,
    useOrderTypes,
    useSalaryRuleTypes,
    useServiceCategories,
    useWarehouses,
    SERVICE_RULE_FORM_CONFIG,
} from '@/features/SalaryRuleForm'
import { useDepartments } from '@/features/TargetDirectory'

import { useMotivationSchema } from './useMotivationSchema.ts'

/**
 * "Фаза загрузки": всё, что нужно ДО того, как можно смонтировать саму форму (черновики правил
 * ещё не существуют — они зависят от данных, которые могут быть ещё не загружены). Справочник
 * типов правил (`useSalaryRuleTypes`) запрашивается здесь же, а не внутри формы — он не зависит от
 * `schema`, так что не обязан ждать её загрузки, и его данные (список допустимых ролей) нужны
 * форме сразу с первого рендера, без отдельного собственного лоадера внутри.
 */
export function useServiceSchemaEditPage(id: string) {
    const schemaQuery = useMotivationSchema(id)
    const ruleTypesQuery = useSalaryRuleTypes()
    const orderTypesQuery = useOrderTypes()
    const warehousesQuery = useWarehouses()
    const categoriesQuery = useServiceCategories()
    const departmentsQuery = useDepartments()

    const allowedRolesByType = useAllowedRolesByType(ruleTypesQuery.data)

    return {
        schema: schemaQuery.data ?? null,
        isLoading: schemaQuery.isLoading,
        errorMessage: schemaQuery.error?.message ?? null,
        config: SERVICE_RULE_FORM_CONFIG,
        allowedRolesByType,
        isRoleTypesLoading: ruleTypesQuery.isLoading,
        roleTypesError: ruleTypesQuery.error?.message ?? null,
        orderTypes: orderTypesQuery.data ?? [],
        isOrderTypesLoading: orderTypesQuery.isLoading,
        orderTypesError: orderTypesQuery.error?.message ?? null,
        warehouses: warehousesQuery.data ?? [],
        isWarehousesLoading: warehousesQuery.isLoading,
        warehousesError: warehousesQuery.error?.message ?? null,
        categories: categoriesQuery.categories,
        isCategoriesLoading: categoriesQuery.isLoading,
        categoriesError: categoriesQuery.error?.message ?? null,
        // Временный костыль (`DepartmentPercent`/`DepartmentPlanBonus`, см.
        // `RuleFormConfig.departmentOverrideRuleTypes`).
        departments: departmentsQuery.data ?? [],
        isDepartmentsLoading: departmentsQuery.isLoading,
        departmentsError: departmentsQuery.error?.message ?? null,
    }
}
