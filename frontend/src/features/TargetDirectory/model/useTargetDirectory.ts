import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/**
 * Отделы/сотрудники (`GET /v1/directory/departments|employees`) — общий Bitrix-справочник целей
 * начисления, используемый и Шагом 1 создания схемы (`pages/SalaryRules`), и фильтрами списка схем
 * (`pages/SalaryRuleList`). Два отдельных хука (не один `useTargetDirectory(targetType)`), чтобы оба
 * списка можно было держать в кэше TanStack Query одновременно и мгновенно переключаться между
 * "Отдел"/"Сотрудник" без повторной загрузки уже подгруженного списка.
 */
export function useDepartments() {
    return useQuery(api.getDepartments())
}

export function useEmployees() {
    return useQuery(api.getEmployees())
}
