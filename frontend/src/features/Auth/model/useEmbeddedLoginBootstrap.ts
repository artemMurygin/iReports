import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { detectRuntimeContext } from '@/shared/lib/runtime-context.ts'
import { setSessionToken } from '@/shared/api/session-token.ts'

import { api, AUTH_ME_QUERY_KEY } from './api.ts'

/**
 * add-bitrix24-auth-and-rbac, разделы 15/16 tasks.md (см. финальный отчёт
 * раздела 15 — реализация самого вызова `BX24.init()`/`getAuth()` была
 * сознательно отложена на позже; раздел 21.3 фиксирует, что сквозной
 * embedded-сценарий не был пройден вручную из-за отсутствия доступа к
 * реальному порталу). Замыкает эту недостающую часть embedded/iframe-
 * сценария входа: `spec: auth#embedded-login-success` требует, чтобы
 * backend создавал сессию по данным `BX24.init()` — до этого хука на
 * фронтенде не было кода, который бы этот вызов реально делал (была только
 * заготовка `shared/api/session-token.ts`, используемая лишь тестами).
 *
 * Срабатывает один раз при старте приложения, и только в iframe-контексте
 * (`detectRuntimeContext() === 'iframe'`, `shared/lib/runtime-context.ts`) —
 * в standalone-контексте `window.BX24` отсутствует по определению этого
 * контекста, поэтому хук не пытается его вызвать. `BX24.init(callback)`
 * инициализирует SDK асинхронно (документация Bitrix24); внутри callback
 * `BX24.getAuth()` синхронно возвращает данные текущей сессии BX24 (или
 * `false`, если инициализация ещё не готова к выдаче токена).
 *
 * По успеху — `setSessionToken` (in-memory holder, читается axios-
 * интерцептором `shared/api/axios.instance.ts`) и инвалидация
 * `AUTH_ME_QUERY_KEY` (тот же ключ ['auth-me'], которым пользуются и
 * `RouteGuard`/`route-guard/model/session.api.ts`, и `useCurrentUser` —
 * см. WHY в `model/api.ts`), чтобы оба места сразу увидели свежую сессию,
 * не дожидаясь `staleTime`.
 *
 * По ошибке — тот же fail-closed приём, что и у `routeGuardApi.
 * getCurrentSession`/`api.getCurrentUser`: не крашим приложение и просто не
 * устанавливаем токен — `RouteGuard` для iframe-контекста в любом случае
 * рендерит детей без сессии (см. WHY в `RouteGuard.tsx`), поэтому здесь
 * достаточно молча остаться неаутентифицированным, а не показывать
 * пользователю текст ошибки.
 */
export function useEmbeddedLoginBootstrap(): void {
    const queryClient = useQueryClient()

    useEffect(() => {
        if (detectRuntimeContext() !== 'iframe') return

        const bx24 = window.BX24
        if (bx24 === undefined) return

        bx24.init(() => {
            const authInfo = bx24.getAuth()
            if (authInfo === false) return

            api.embeddedLogin({
                authId: authInfo.access_token,
                memberId: authInfo.member_id,
                domain: authInfo.domain,
            })
                .then((response) => {
                    setSessionToken(response.sessionId)
                    void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY })
                })
                .catch(() => {
                    // fail-closed — см. JSDoc выше: остаёмся без сессии, ничего не показываем.
                })
        })
        // Пустой массив зависимостей — эффект должен сработать РОВНО один раз при монтировании
        // (`EmbeddedLoginBootstrap`, `frontend/src/app/`), не при каждом ререндере: повторный
        // `BX24.init()`/`embedded-login` запрос на каждый ререндер бессмысленен и создавал бы
        // лишнюю нагрузку на backend. `queryClient` из `useQueryClient()` стабилен между рендерами
        // (тот же инстанс, что и `QueryClientProvider` в `app/main.tsx`), поэтому пропуск его в
        // массиве зависимостей не приводит к использованию устаревшего значения.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
}
