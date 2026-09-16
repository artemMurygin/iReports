import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'
import { buildServiceCategoryTree } from './serviceCategoryTree.ts'

/**
 * Справочник категорий услуг для `CategoryField` у сервисных правил `DepartmentPercent`/
 * `DepartmentPlanBonus`/`DepartmentTurnoverBonus` (`category` есть в service-схеме этих правил,
 * `contracts/commands/salary-rule.ts:280-347`) — плоский ответ backend преобразуется в дерево
 * `CatalogCategoryResponse`, которого ждёт `CategoryField` (`serviceCategoryTree.ts`).
 */
export function useServiceCategories() {
    const query = useQuery(api.getServiceCategories())
    const categories = useMemo(() => (query.data ? buildServiceCategoryTree(query.data) : []), [query.data])

    return { ...query, categories }
}
