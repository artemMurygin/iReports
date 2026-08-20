import { RefreshTransitionLayout } from '@/shared/ui/RefreshTransitionLayout.tsx'

import { SchemaEditNotFound } from '../../ui/SchemaEditNotFound.tsx'
import { useServiceSchemaEditPage } from '../model/useServiceSchemaEditPage.ts'

import { ServiceSchemaEditForm } from './ServiceSchemaEditForm.tsx'

export type ServiceSchemaEditProps = {
    id: string
}

/**
 * "Фаза загрузки" направления "Сервис" — единственный презентационный компонент этого поддерева,
 * которому разрешено ветвиться (тот же прецедент, что `pages/SalaryRuleList/ui/SchemaListBody.tsx`):
 * ошибка (404 — схемы нет или у неё 0 правил `service`, см. `SchemaEditNotFound`) -> спиннер
 * (`RefreshTransitionLayout`'s `isInitialLoad`) -> собственно форма. `ServiceSchemaEditForm`
 * монтируется с `key={schema.id}` — гарантирует пересоздание (а значит, чистую переинициализацию
 * `useSalaryRulesDraft`'s состояния) при переходе на другую схему без полного размонтирования этого
 * узла (см. `model/useServiceSchemaEditForm.ts`'s комментарий).
 */
export function ServiceSchemaEdit({ id }: ServiceSchemaEditProps) {
    const page = useServiceSchemaEditPage(id)

    if (page.errorMessage) return <SchemaEditNotFound message={page.errorMessage} />

    return (
        <RefreshTransitionLayout isInitialLoad={page.isLoading} loadingLabel="Загрузка схемы...">
            {page.schema && (
                <ServiceSchemaEditForm
                    key={page.schema.id}
                    schema={page.schema}
                    config={page.config}
                    allowedRolesByType={page.allowedRolesByType}
                    isRoleTypesLoading={page.isRoleTypesLoading}
                    roleTypesError={page.roleTypesError}
                />
            )}
        </RefreshTransitionLayout>
    )
}
