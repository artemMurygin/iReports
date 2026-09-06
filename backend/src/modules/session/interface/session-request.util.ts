import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import {
    COOKIE_DOMAIN,
    CSRF_COOKIE_NAME,
    CSRF_SECRET,
    SESSION_COOKIE_NAME,
    SESSION_TTL_SECONDS,
} from '../session.config';

// Общая точка чтения session_id из запроса (Authorization: Bearer — iframe,
// spec: session#header-delivery-for-iframe; cookie — standalone/iOS, spec:
// session#cookie-delivery-for-standalone-and-ios). Вынесено из
// SessionAuthGuard (раздел 7 tasks.md) в отдельный модуль, чтобы разделом 12
// им же мог воспользоваться LogoutHttpController — тот же приём поиска
// session_id, не дублирующий код.
export function extractSessionId(request: Request): string | null {
    const authHeader = request.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim();
    }

    // Request.cookies типизирован @types/cookie-parser как Record<string,
    // any> (не optional), но на практике остаётся undefined, если
    // cookie-parser не подключён middleware'ом (например, в тестовом
    // окружении без него) — `?.` защищает от TypeError вместо честного 401
    // (fail-closed по сути того же принципа, что и Decision 10 design.md).
    const cookieSessionId = request.cookies?.[SESSION_COOKIE_NAME] as
        string | undefined;

    return cookieSessionId ?? null;
}

// Клиенты, у которых остался session_id/csrf_token, выставленный ДО того, как
// появился COOKIE_DOMAIN (без Domain-атрибута, т.е. scope'ился только на
// текущий хост), иначе продолжают слать в браузере ОБА варианта одной cookie
// сразу — старый (без Domain) и новый (с Domain). `cookie-parser`
// (`cookie.parse`) при дубликате имени в заголовке `Cookie` оставляет ПЕРВОЕ
// встреченное значение, а браузер ставит более старую (по времени создания)
// cookie раньше — то есть побеждает протухший session_id, и вход выглядит
// так, будто вообще не работает, хотя backend только что выдал валидную
// сессию. Явно чистим cookie без Domain при каждой выдаче/очистке — не только
// исторический артефакт этого конкретного перехода: та же коллизия
// повторится для любого будущего изменения COOKIE_DOMAIN.
function clearHostScopedCookie(
    res: Response,
    name: string,
    options: Parameters<Response['clearCookie']>[1],
): void {
    if (!COOKIE_DOMAIN) return;
    res.clearCookie(name, { ...options, domain: undefined });
}

// Устанавливает session_id-cookie для cookie-варианта доставки (spec:
// session#cookie-delivery-for-standalone-and-ios) — HttpOnly (JS не может
// прочитать), Secure, SameSite=None (кросс-сайтовый iframe/редирект OAuth).
export function applySessionCookie(res: Response, sessionId: string): void {
    const options = {
        httpOnly: true,
        secure: true,
        sameSite: 'none' as const,
        path: '/',
    };
    clearHostScopedCookie(res, SESSION_COOKIE_NAME, options);
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
        ...options,
        maxAge: SESSION_TTL_SECONDS * 1000,
        domain: COOKIE_DOMAIN,
    });
}

export function clearSessionCookie(res: Response): void {
    const sessionOptions = { httpOnly: true, secure: true, sameSite: 'none' as const, path: '/' };
    const csrfOptions = { secure: true, sameSite: 'none' as const, path: '/' };
    clearHostScopedCookie(res, SESSION_COOKIE_NAME, sessionOptions);
    clearHostScopedCookie(res, CSRF_COOKIE_NAME, csrfOptions);
    res.clearCookie(SESSION_COOKIE_NAME, { ...sessionOptions, domain: COOKIE_DOMAIN });
    res.clearCookie(CSRF_COOKIE_NAME, { ...csrfOptions, domain: COOKIE_DOMAIN });
}

// Double-submit CSRF (design.md, Decision 7): значение — HMAC-SHA256(session_id)
// с серверным секретом, НЕ хранится отдельной записью в Redis. Cookie ниже
// умышленно НЕ HttpOnly — фронтенд обязан прочитать её и вернуть тем же
// значением в заголовке CSRF_HEADER_NAME при мутирующих запросах
// (CsrfGuard сверяет два независимых канала — cookie автоматически
// отправляется браузером кросс-сайтово, заголовок кросс-сайтовый скрипт
// проставить не может из-за CORS).
export function computeCsrfToken(sessionId: string): string {
    return createHmac('sha256', CSRF_SECRET).update(sessionId).digest('hex');
}

export function applyCsrfCookie(res: Response, sessionId: string): void {
    const options = { httpOnly: false, secure: true, sameSite: 'none' as const, path: '/' };
    clearHostScopedCookie(res, CSRF_COOKIE_NAME, options);
    res.cookie(CSRF_COOKIE_NAME, computeCsrfToken(sessionId), {
        ...options,
        maxAge: SESSION_TTL_SECONDS * 1000,
        domain: COOKIE_DOMAIN,
    });
}

// Сравнение постоянным временем — обычный `===` на секретных значениях
// теоретически уязвим к timing-атаке (пусть и малопрактичной для CSRF-токена
// такой длины); timingSafeEqual требует буферов равной длины, поэтому длины
// сверяются отдельно.
export function isValidCsrfToken(provided: string, sessionId: string): boolean {
    const expected = computeCsrfToken(sessionId);
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return timingSafeEqual(providedBuffer, expectedBuffer);
}
