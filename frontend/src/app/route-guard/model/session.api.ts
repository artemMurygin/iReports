import { queryOptions } from '@tanstack/react-query'
import type { AuthMeResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'

// add-bitrix24-auth-and-rbac, раздел 15 tasks.md — минимальная проверка
// текущей сессии для route-guard'а (`GET /v1/auth/me`, см.
// backend/src/config/app.routes.ts `routesV1.auth.me`, backend/src/modules
// /auth/interface/http-controllers/get-current-user.http.controller.ts).
//
// `features/Auth` (раздел 16 tasks.md) станет каноническим потребителем
// того же эндпоинта для остального приложения (Header, меню, useHasPermission
// и т.д., с кэшем в Zustand) — этот запрос используется тем же
// query-ключом ('auth-me'), чтобы TanStack Query отдавал один и тот же
// закэшированный результат обоим местам, а не дублировал сетевой запрос.
export const AUTH_SESSION_QUERY_KEY = ['auth-me'] as const

// 401 здесь — ОЖИДАЕМОЕ состояние "сессии ещё нет" (например, первый визит
// standalone-сайта), а не ошибка приложения, поэтому в отличие от обычной
// конвенции `ApiError` в `.catch()` (frontend/CLAUDE.md) любая неудача
// запроса — в том числе сетевая — сворачивается в `null` ("нет
// подтверждённой сессии"), а не прокидывается как исключение: guard не
// показывает пользователю текст ошибки, а просто ведёт себя так, будто
// сессии нет (fail-closed, тот же принцип, что и на backend, design.md
// Decision 10).
export const routeGuardApi = {
    getCurrentSession: () =>
        queryOptions({
            queryKey: AUTH_SESSION_QUERY_KEY,
            queryFn: (): Promise<AuthMeResponse | null> =>
                apiInstance
                    .get<AuthMeResponse>('/v1/auth/me')
                    .then((response) => response.data)
                    .catch(() => null),
            retry: false,
            staleTime: 60_000,
        }),
}
