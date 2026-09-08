import axios from 'axios'
import qs from 'qs'

import { detectRuntimeContext } from '@/shared/lib/runtime-context.ts'
import { getSessionToken } from '@/shared/api/session-token.ts'

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
        // Без этого заголовка ngrok free-tier отдаёт браузерным User-Agent'ам межстраничную
        // заглушку-предупреждение (ERR_NGROK_6024) вместо ответа backend — без CORS-заголовков,
        // поэтому браузер видит это как сетевую/CORS-ошибку. Заголовок не имеет эффекта, если
        // VITE_API_URL не указывает на ngrok-туннель (используется для локального тестирования
        // OAuth-логина Bitrix24).
        'ngrok-skip-browser-warning': 'true',
        // Аналогичный обход для localtunnel (loca.lt) — без него первый запрос от нового
        // публичного IP получает HTML-страницу "friendly reminder" вместо ответа backend.
        'bypass-tunnel-reminder': 'true',
    },
    paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
    // Доставка session_id для standalone-сайта/iOS — HttpOnly/Secure/
    // SameSite=None cookie, устанавливаемая backend'ом через Set-Cookie
    // (add-bitrix24-auth-and-rbac, spec: session#cookie-delivery-for-
    // standalone-and-ios). Backend и frontend обслуживаются с разных origin
    // (см. VITE_API_URL) — без withCredentials браузер не отправит cookie
    // кросс-origin и не примет ответный Set-Cookie через axios/XHR.
    withCredentials: true,
})

// Доставка session_id для iframe-контекста — заголовок
// Authorization: Bearer <session_id> (add-bitrix24-auth-and-rbac, раздел 15
// tasks.md; spec: session#header-delivery-for-iframe) — cookie в iframe
// портала Bitrix24 ненадёжны из-за SameSite/ITP-ограничений браузеров.
// Применяется только в iframe-контексте: в standalone/iOS доставка идёт
// через cookie (withCredentials выше), подставлять пустой/чужой заголовок
// там не нужно.
// Имена cookie/заголовка CSRF double-submit — та же пара, что backend
// использует в `backend/src/modules/session/session.config.ts`
// (`CSRF_COOKIE_NAME`/`CSRF_HEADER_NAME`); не переиспользованы напрямую
// (backend и frontend — раздельные приложения), см. WHY ниже.
const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const SAFE_HTTP_METHODS = new Set(['get', 'head', 'options'])

function readCookie(name: string): string | undefined {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : undefined
}

api.interceptors.request.use((config) => {
    if (detectRuntimeContext() === 'iframe') {
        const sessionToken = getSessionToken()
        if (sessionToken) {
            config.headers.set('Authorization', `Bearer ${sessionToken}`)
        }
    }

    // CSRF double-submit cookie для cookie-варианта доставки сессии
    // (add-bitrix24-auth-and-rbac, design.md Decision 7; раздел 13 tasks.md
    // note: "фронтенд обязан прочитать её через document.cookie и вернуть
    // тем же значением в заголовке x-csrf-token") — ни один раздел tasks.md
    // не завёл для этого отдельную frontend-задачу явно, добавлено здесь как
    // необходимое условие того, чтобы мутирующие запросы `features/Auth`
    // (`POST /v1/auth/logout`, раздел 16) и `features/RoleManagement`
    // проходили `CsrfGuard`, а не отклонялись 403-м. Cookie не HttpOnly
    // (design.md), поэтому JS может её прочитать; для iframe-контекста
    // (Authorization-заголовок) `CsrfGuard` эту проверку не применяет
    // вовсе, но подставить заголовок здесь безвредно, если cookie всё же
    // присутствует.
    const method = config.method?.toLowerCase()
    if (method !== undefined && !SAFE_HTTP_METHODS.has(method)) {
        const csrfToken = readCookie(CSRF_COOKIE_NAME)
        if (csrfToken) {
            config.headers.set(CSRF_HEADER_NAME, csrfToken)
        }
    }

    return config
})
