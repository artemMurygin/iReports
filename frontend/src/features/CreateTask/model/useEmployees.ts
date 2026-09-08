import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/** Справочник сотрудников (`GET /v1/directory/employees`) для селекта «Ответственный» —
 * своя копия запроса (см. WHY в `api.ts`), не `features/TargetDirectory`'s `useEmployees`. */
export function useEmployees() {
    return useQuery(api.getEmployees())
}
