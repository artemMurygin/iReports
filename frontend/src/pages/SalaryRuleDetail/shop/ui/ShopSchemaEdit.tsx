import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

import { SchemaEditNotFound } from '../../ui/SchemaEditNotFound.tsx'
import { useShopSchemaEditPage } from '../model/useShopSchemaEditPage.ts'

import { ShopSchemaEditForm } from './ShopSchemaEditForm.tsx'

export type ShopSchemaEditProps = {
    id: string
}

/** Зеркало `service/ui/ServiceSchemaEdit.tsx` для направления "Магазин". */
export function ShopSchemaEdit({ id }: ShopSchemaEditProps) {
    const page = useShopSchemaEditPage(id)

    if (page.errorMessage) return <SchemaEditNotFound message={page.errorMessage} />

    return (
        <RefreshTransitionLayout isInitialLoad={page.isLoading} loadingLabel="Загрузка схемы...">
            {page.schema && (
                <ShopSchemaEditForm
                    key={page.schema.id}
                    schema={page.schema}
                    config={page.config}
                    allowedRolesByType={page.allowedRolesByType}
                    isRoleTypesLoading={page.isRoleTypesLoading}
                    roleTypesError={page.roleTypesError}
                    categories={page.categories}
                    isCategoriesLoading={page.isCategoriesLoading}
                    categoriesError={page.categoriesError}
                    orderTypes={page.orderTypes}
                    isOrderTypesLoading={page.isOrderTypesLoading}
                    orderTypesError={page.orderTypesError}
                />
            )}
        </RefreshTransitionLayout>
    )
}
