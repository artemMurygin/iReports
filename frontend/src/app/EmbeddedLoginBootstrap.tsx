import { useEmbeddedLoginBootstrap } from '@/features/Auth'

/**
 * add-bitrix24-auth-and-rbac, разделы 15/16 tasks.md; spec:
 * auth#embedded-login-success — запускает embedded/iframe-логин (`BX24.
 * init()` -> `BX24.getAuth()` -> `POST /v1/auth/embedded-login`) один раз при
 * старте приложения, до того как остальное дерево успеет смонтироваться и
 * дёрнуть защищённые API (см. WHY в `route-guard/ui/RouteGuard.tsx` —
 * `RouteGuard` рендерит детей в iframe-контексте даже без сессии, поэтому
 * логин должен успеть отработать заранее, а не по действию пользователя).
 * Не рендерит ничего — только сайд-эффект хука, размещается рядом с
 * `<RouterProvider>` в `main.tsx`, не оборачивая и не блокируя дерево.
 */
export function EmbeddedLoginBootstrap() {
    useEmbeddedLoginBootstrap()
    return null
}
