import axios from 'axios'
import qs from 'qs'

import { detectRuntimeContext } from '@/shared/lib/runtime-context.ts'
import { getSessionToken } from '@/shared/api/session-token.ts'

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
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
api.interceptors.request.use((config) => {
    if (detectRuntimeContext() === 'iframe') {
        const sessionToken = getSessionToken()
        if (sessionToken) {
            config.headers.set('Authorization', `Bearer ${sessionToken}`)
        }
    }

    return config
})
