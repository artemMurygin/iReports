import { queryOptions } from '@tanstack/react-query'
import type { ListMotivationSchemasResponse, ListShopMotivationSchemasResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

import type { MotivationSchemaListItem, RuleType } from './types.ts'

/**
 * `GET /v1/service/motivation-schema` + `GET /v1/shop/accounting/motivation-schema` (см.
 * `backend`'s `ListMotivationSchemasService`/`ListShopMotivationSchemasService`) — заменяет мок
 * (`mockSchemas.ts`, удалён) реальными запросами обоих направлений, слитыми в один список. Контракт
 * (`MotivationSchemaListItem` из `ireports-contracts`) отдаёт цель как вложенный `target: {type, id,
 * name}` — здесь он разворачивается в плоские `targetType`/`targetId`/`targetName`, чтобы
 * `deriveTargetOptions.ts`/`filterSchemas.ts`/`SchemaGrid.tsx`/`SchemaListMobile.tsx` не пришлось
 * переписывать под вложенную форму (см. `model/types.ts`'s локальный тип).
 *
 * Никакой пагинации/сортировки на бэкенде нет (объём справочника мал, см. план) — сортировка по
 * `updatedAt` (свежие сверху) происходит здесь же, один раз на объединённый список, а не отдельно на
 * каждой половине.
 */
function toListItem(
    schema: ListMotivationSchemasResponse[number] | ListShopMotivationSchemasResponse[number],
): MotivationSchemaListItem {
    return {
        id: schema.id,
        name: schema.name,
        direction: schema.direction,
        targetType: schema.target.type,
        targetId: schema.target.id,
        targetName: schema.target.name,
        ruleCount: schema.ruleCount,
        ruleTypes: schema.ruleTypes as RuleType[],
        updatedAt: typeof schema.updatedAt === 'string' ? schema.updatedAt : schema.updatedAt.toISOString(),
    }
}

async function fetchMotivationSchemas(signal: AbortSignal): Promise<MotivationSchemaListItem[]> {
    const [serviceSchemas, shopSchemas] = await Promise.all([
        apiInstance
            .get<ListMotivationSchemasResponse>('/v1/service/motivation-schema', { signal })
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось загрузить схемы сервиса ' + error)
            }),
        apiInstance
            .get<ListShopMotivationSchemasResponse>('/v1/shop/accounting/motivation-schema', { signal })
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось загрузить схемы магазина ' + error)
            }),
    ])

    return [...serviceSchemas.map(toListItem), ...shopSchemas.map(toListItem)].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
}

export const api = {
    getMotivationSchemas: () =>
        queryOptions({
            queryKey: ['salary-rule-list', 'schemas'],
            queryFn: ({ signal }) => fetchMotivationSchemas(signal),
        }),
}
