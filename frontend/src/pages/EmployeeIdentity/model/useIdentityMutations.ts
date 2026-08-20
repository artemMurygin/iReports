import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateEmployeeIdentityRequest, UpdateEmployeeIdentityRequest } from 'ireports-contracts'

import { api, IDENTITIES_QUERY_KEY } from './api.ts'

/** Аргумент PATCH: id связи в пути, тело — только то, что вообще разрешено менять контрактом. */
export type UpdateIdentityArgs = { id: string; payload: UpdateEmployeeIdentityRequest }

/**
 * Три мутации CRUD над связями. Все инвалидируют один и тот же ключ — список связей
 * (`IDENTITIES_QUERY_KEY`): справочники сотрудников/отделов от них не меняются, а таблица,
 * карточка «Покрытие ERP» и фильтры считаются из этого списка, поэтому одной инвалидации
 * хватает, чтобы экран целиком пришёл в согласованное состояние.
 *
 * Тосты и закрытие модалок сюда не заезжают: это решает вызывающий (`useEmployeeIdentityPage`)
 * — он же знает, какая модалка открыта и что писать в сообщении.
 */
export function useIdentityMutations() {
    const queryClient = useQueryClient()
    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: IDENTITIES_QUERY_KEY })
    }

    const createIdentity = useMutation({
        mutationFn: (payload: CreateEmployeeIdentityRequest) => api.createIdentity(payload),
        onSuccess: invalidate,
    })

    const updateIdentity = useMutation({
        mutationFn: ({ id, payload }: UpdateIdentityArgs) => api.updateIdentity(id, payload),
        onSuccess: invalidate,
    })

    const deleteIdentity = useMutation({
        mutationFn: (id: string) => api.deleteIdentity(id),
        onSuccess: invalidate,
    })

    return { createIdentity, updateIdentity, deleteIdentity }
}
