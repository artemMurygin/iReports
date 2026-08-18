import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/**
 * Отделы/сотрудники (Фаза 1, `GET /v1/directory/departments|employees`) для зависимого select'а
 * Шага 1 — какой из двух запросов используется, решает `targetType` в `SalaryRulesTargetCard`
 * (не фильтр здесь: обе выборки полные, см. комментарий в `model/api.ts`'s `getEmployees`).
 * Два отдельных хука (не один `useTargetDirectory(targetType)`), чтобы оба списка можно было
 * держать в кэше TanStack Query одновременно и мгновенно переключаться между "Отдел"/"Сотрудник"
 * без повторной загрузки уже подгруженного списка.
 */
export function useDepartments() {
    return useQuery(api.getDepartments())
}

export function useEmployees() {
    return useQuery(api.getEmployees())
}
